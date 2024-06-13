// Use this code snippet in your app.
// If you need more information about configurations or implementing the sample code, visit the AWS docs:
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started.html


const SM = require('@aws-sdk/client-secrets-manager');

  
  const secret_name = "power-shower-code";
  const getAPIToken = async function(auth)
  {
    return new Promise(async (resolve, reject)=>{
        console.log("INside getAPIToken: ",secret_name)
        const client = new SM.SecretsManagerClient({
            region: "us-east-1",
          });
          
          let response;
          
          try {
            response = await client.send(
              new SM.GetSecretValueCommand({
                SecretId: secret_name+auth,
                VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
              })
            );
            const secret = response.SecretString;
             return resolve(secret);
          } catch (error) {
            console.log("Error at getAPIToken: ",JSON.stringify(error));
            // For a list of exceptions thrown, see
            // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
            return reject(error);
          }
    });
 
    
  }

  const updateAPIToken = async function(apiToken,auth)
  {
        // Your code goes here
        return new Promise(async(resolve,reject)=>{
            try {
                console.log("Inside updateAPIToken")
                const client = await new SM.SecretsManagerClient({
                    region: "us-east-1",
                  });
                const input = { // UpdateSecretRequest
                SecretId: secret_name+auth, // required
                ClientRequestToken: secret_name+await generateRandomString(30),
                Description: "STRING_VALUE",
                KmsKeyId: "",
                SecretString: apiToken,
                };
                const command = new SM.UpdateSecretCommand(input);
                const response = await client.send(command);
                console.log(response)
                // { // UpdateSecretResponse
                //   ARN: "STRING_VALUE",
                //   Name: "STRING_VALUE",
                //   VersionId: "STRING_VALUE",
                // };
                return resolve(response);
            } catch (error) {
                console.log("Error at updateAPIToken: ",JSON.stringify(error));
            // For a list of exceptions thrown, see
            // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
            return reject(error);
            }
        });
       
  }

  function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
  
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }
  
    return result;
  }
  
  module.exports = {getAPIToken,
    updateAPIToken
};
 
  
 
 
