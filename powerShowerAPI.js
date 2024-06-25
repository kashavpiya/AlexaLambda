var request = require('request');

const AWSSecretManagerForAPIToken = require('./AWSSecretManagerForAPIToken');
const alexaNotificationTokenFromCode = async function (refresh) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("Inside alexaNotificationTokenFromCode");
      const code = await AWSSecretManagerForAPIToken.getAPIToken("");
      console.log("code: ",code);
      var options = {
        'method': 'POST',
        'url': 'https://api.amazon.com/auth/O2/token',
        'headers': {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
          'grant_type': 'authorization_code',
          'client_id': 'amzn1.application-oa2-client.1a1c39db02cf4e3e9b8201aa40c63951',
          'client_secret': 'amzn1.oa2-cs.v1.fe145c22c788e9e66aa229a27403fb6f1080f44218ad3f2bb3339912e36b3a4d',
          'code': await code
        }
      };
    
      request(options, async function (error, response) {
        if (error) {
          console.log("Error at alexaNotificationRefreshToken: ", JSON.stringify(error));
          return reject(error);
        }
        else {
          console.log("alexaNotificationTokenFromCode response->" + JSON.stringify(response));
          let responseData = await JSON.parse(response.body);
          if(refresh != undefined && refresh == "refresh")
          {
            return resolve(responseData.refresh_token);
          }
          
          return resolve(responseData.access_token);
        }


      });
    } catch (error) {
      console.log("Error at alexaNotificationTokenFromCode: ", JSON.stringify(error));
      return reject(error);
    }
  });
};
const alexaNotificationRefreshToken = async function () {
  return new Promise(async (resolve, reject) => {
    try {
      var options = {
        'method': 'POST',
        'url': 'https://api.amazon.com/auth/o2/token',
        'headers': {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
          'grant_type': 'refresh_token',
          'refresh_token': await AWSSecretManagerForAPIToken.getAPIToken("-refresh"),
          'client_id': 'amzn1.application-oa2-client.1a1c39db02cf4e3e9b8201aa40c63951',
          'client_secret': 'amzn1.oa2-cs.v1.fe145c22c788e9e66aa229a27403fb6f1080f44218ad3f2bb3339912e36b3a4d'
        }
      };
      
      request(options, async function (error, response) {
        if (error) {
          console.log("Error at alexaNotificationRefreshToken: ", JSON.stringify(error));
          return resolve(false);
        }
        else {
          console.log("alexaNotificationRefreshToken response->" + JSON.stringify(response));
          let responseData = await JSON.parse(response.body);
          return resolve(responseData.access_token);
        }


      });
    } catch (error) {
      console.log("Error at getAllDevicesFromAccount: ", JSON.stringify(error));
      return reject(error);
    }
  });
};

const sendAlexaNotification = async function (data) {
  console.log("sendAlexaNotification Data: ",JSON.stringify(data));
  return new Promise(async (resolve, reject) => {
    let access_token = await alexaNotificationRefreshToken();
    console.log("access_token: ",access_token);
    if(typeof access_token =='boolean' && access_token == false)
    {
      access_token = await alexaNotificationTokenFromCode();
    }
    console.log("access_token2: ",access_token);
    try {
      var options = {
        'method': 'POST',
        'url': 'https://api.amazonalexa.com/v3/events',
        'headers': {
          'Authorization': 'Bearer '+ access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      
      };
     
      request(options, async function (error, response) {
        if (error) {
          console.log("Error at sendAlexaNotification: ", JSON.stringify(error));
          return reject(error);
        }
        else {
          console.log("sendAlexaNotification response->" + JSON.stringify(response));
          let responseData = response.body;
          return resolve(responseData);
        }


      });
    } catch (error) {
      console.log("Error at getAllDevicesFromAccount: ", JSON.stringify(error));
      return reject(error);
    }
  });
};

const getAllDevicesFromAccount = async function (token) {
  return new Promise(async (resolve, reject) => {
    try {

      var options = {
        'method': 'POST',
        'url': 'https://api.powershower.net/api/iot/user/queryAll',
        'headers': {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'Cookie': 'JSESSIONID=9AE322BBC2C49577B5E72DB279473C94'
        }


      };
      request(options, async function (error, response) {
        if (error) {
          console.log("Error at getAllDevicesFromAccount: ", JSON.stringify(error));
          return reject(error);
        }
        else {
          console.log("getAllDevicesFromAccount response->" + JSON.stringify(response));
          let responseData = await JSON.parse(response.body);
          return resolve(responseData);
        }


      });
    } catch (error) {
      console.log("Error at getAllDevicesFromAccount: ", JSON.stringify(error));
      return reject(error);
    }
  });
};
const getAllDevicesFromAccountWithUserId = async function (token) {
  return new Promise(async (resolve, reject) => {
    try {

      var options = {
        'method': 'POST',
        'url': 'https://api.powershower.net/api/iot/user/query',
        'headers': {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'Cookie': 'JSESSIONID=9AE322BBC2C49577B5E72DB279473C94'
        }
        ,
        body: JSON.stringify({
          "userId": 58
        })

      };
      request(options, async function (error, response) {
        if (error) {
          console.log("Error at getAllDevicesFromAccountWithUserId: ", JSON.stringify(error));
          return reject(error);
        }
        else {
          console.log("getAllDevicesFromAccountWithUserId response->" + response.body);
          let responseData = await JSON.parse(response.body);
          return resolve(responseData);
        }


      });
    } catch (error) {
      console.log("Error at getAllDevicesFromAccountWithUserId: ", JSON.stringify(error));
      return reject(error);
    }
  });
};

const getDeviceQuery = async function (token, deviceId, userName, userId) {
  return new Promise(async (resolve, reject) => {
    try {
        var request = require('request');
        var options = {
          'method': 'GET',
          'url': 'http://api.powershower.net/api/iot/user/queryDeviceId?deviceId=' + deviceId,
          'headers': {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
            'Cookie': 'JSESSIONID=9AE322BBC2C49577B5E72DB279473C94'
          },
          body: JSON.stringify({
            "username": userName,
            "userId": userId
          })
        };

        request(options, async function (error, response) {
          if (error) {
            console.log("Error at getDeviceQuery: ", JSON.stringify(error));
            return reject(error);
          } else {
            console.log("getDeviceQuery response->" + response.body);
            let responseData = await JSON.parse(response.body);
            return resolve(responseData);
          }
        });
    } catch (error) {
      console.log("Error at getDeviceQuery: ", JSON.stringify(error));
      return reject(error);
    }
  });
};

const sendShowerCommand = async function (token, deviceId, command) {
  return new Promise(async (resolve, reject) => {
    try {

      console.log("token: ",token);
      console.log("deviceId: ",deviceId);
      console.log("command: ",command);
      var options = {
        'method': 'POST',
        'url': 'https://api.powershower.net/api/iot/device/showerControl',
        'headers': {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'Cookie': 'JSESSIONID=925D2E964B5C3B2C0B72E288E4AE3524'
        },
        body: JSON.stringify({
          "device_id": deviceId,
          "command": command
        })

      };

      request(options, async function (error, response) {
        if (error) {
          console.log("Error at sendShowerCommand: ", JSON.stringify(error));
          return reject(error);
        }
        else {
          console.log("sendShowerCommand response->" + response.body);
          let responseData = await JSON.parse(response.body);
          return resolve(responseData);
        }


      });
    } catch (error) {
      console.log("Error at sendShowerCommand: ", JSON.stringify(error));
      return reject(error);
    }
  });
};


module.exports = {
  alexaNotificationTokenFromCode,
  getAllDevicesFromAccount,
  getAllDevicesFromAccountWithUserId,
  getDeviceQuery,
  sendShowerCommand,
  sendAlexaNotification
};

