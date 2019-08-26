const functions = require('firebase-functions');

export const MNEMONIC = functions.config().wallet.mnemonic
export const AVATAR = functions.config().wallet.avatar
export const ADDRESS = functions.config().wallet.address

export const SLACK = {
    token: functions.config().slack.token
}

export const MAILJET =
{
    PUBLIC_KEY: functions.config().mailjet.public_key,
    PRIVATE_KEY: functions.config().mailjet.private_key,
    CONTACT_LIST: parseInt(functions.config().mailjet.contact_list),
}