const moment = require('moment-timezone');
const config = require('../config/env');
const { APP_DATE_FORMAT } = require('./dateFormatter');

const LOG_TIMESTAMP_FORMAT = `${APP_DATE_FORMAT} HH:mm:ss`;

function getCurrentLogTimestamp() {
  return moment().tz(config.timezone).format(LOG_TIMESTAMP_FORMAT);
}

module.exports = { LOG_TIMESTAMP_FORMAT, getCurrentLogTimestamp };
