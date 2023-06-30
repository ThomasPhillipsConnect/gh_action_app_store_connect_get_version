const core = require('@actions/core');
const shell = require(`shelljs`);
const jwt = require('jsonwebtoken');
const axios = require('axios');

function getToken(issuerID, minute, privateKey, keyId) {
  const payload = { 
    exp: Math.floor(Date.now() / 1000) + (minute * 60),
    aud: "appstoreconnect-v1",
    iss: issuerID
  };
  const options = {
    algorithm: "ES256",
    header: { 
      kid: keyId
    }
  }
  return jwt.sign(payload, privateKey, options);
}

async function get(url, params, token, method = "GET") {
  const options = {
    url: url,
    method: method,
    headers: {
      'Authorization': `Bearer ${token}`
    },
    params: params
  }

  const response = await axios.request(options);
  return response.data;
}

async function getVersion() {
  try {
    const appStoreConnectPrivateKey = core.getInput("appStoreConnectPrivateKey");
    const keyID = core.getInput("keyID");
    const issuerID = core.getInput("issuerID");
    const bundleId = core.getInput("bundleID");
    const token = getToken(issuerID, 2, Buffer.from(appStoreConnectPrivateKey, "utf8"), keyID);
    const appResponse = await get("https://api.appstoreconnect.apple.com/v1/apps", { "filter[bundleId]" : bundleId }, token);
    const appId = appResponse.data[0].id;

    if (appId) {
      const versions = await get("https://api.appstoreconnect.apple.com/v1/apps/" + appId + "/preReleaseVersions", { limit: 200 }, token);
      if (versions.data.length == 0) {
        core.setOutput("appVersion", "0");
        return;
      }
      const appVersion = versions.data[versions.data.length - 1].attributes.version;
      if (appVersion) {
        core.setOutput("appVersion", appVersion);
      } else {
        throw `Could not find the Version Number for ${appId}`;  
      }

      const builds = await get("https://api.appstoreconnect.apple.com/v1/builds", { "filter[app]": appId, limit: 1, sort: "-version" }, token);
      if (builds.data.length == 0) {
        core.setOutput("appBuildVersion", "0");
        return;
      }
      const appBuildVersion = builds.data[0].attributes.version;
      if (appBuildVersion) {
        core.setOutput("appBuildVersion", appBuildVersion);
      } else {
        throw `Could not find the Version Build Number for ${appId}`;  
      }

    } else {
      throw `Could not find the App ID for ${bundleId}`;
    } 
  } catch (error) {
    core.setFailed(error);
  }
}

getVersion();
