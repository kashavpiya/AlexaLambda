const moment = require('moment-timezone');
const currentTime2 = async function() {
    // Get the current time in the Eastern Time Zone (America/New_York)
    const easternTime = moment().tz('America/New_York');

    // Subtract four hours from the current time
    const fourHoursAgo = easternTime.add(4, 'hours');

    // Format the time in the desired format
    const formattedTime = fourHoursAgo.format("YYYY-MM-DDTHH:mm:ss[Z]");

    return formattedTime; // Output: Current time in the specified format four hours ago
}

function getCurrentUTCTimeString() {
    // Get the current time in UTC
    const utcTimeString = moment.utc().format("YYYY-MM-DDTHH:mm:ss[Z]");
    return utcTimeString;
}

console.log(getCurrentUTCTimeString());



const currentTime = async function()
{
// Get the current time in the Eastern Time Zone (America/New_York)
const easternTime = moment().tz('America/New_York');

// Format the time in the desired format
const formattedTime = easternTime.format("YYYY-MM-DDTHH:mm:ss[Z]");


return formattedTime; // Output: Current time in the specified format

}
function getCurrentUTCTime() {
    const now = new Date();
    const utcString = now.toISOString();
    return utcString.slice(0, 19) + 'Z'; // Truncate milliseconds and add 'Z' for Zulu time (UTC)
}
//console.log(getCurrentUTCTimeString());



module.exports = getCurrentUTCTimeString;


// console.log(currentTime2());
// console.log(getCurrentUTCTimeString());