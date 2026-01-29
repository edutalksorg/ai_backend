const { RtcTokenBuilder, RtcRole } = require('agora-token');

const generateAgoraToken = (channelName, uid) => {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_PRIMARY_CERTIFICATE;
    const role = RtcRole.PUBLISHER;

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        role,
        privilegeExpiredTs
    );

    return token;
};

module.exports = { generateAgoraToken };
