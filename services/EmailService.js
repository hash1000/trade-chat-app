const SibApiV3Sdk = require('@getbrevo/brevo');

class EmailService {
  static async sendEmailCode(to, name, code) {
    let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    let apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.EmailService_Key;

    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail(); 

    sendSmtpEmail.subject = "QRM Chat Verification Code";
    sendSmtpEmail.htmlContent = `<html><body><h1>Your verification code is ${code}</h1></body></html>`;
    sendSmtpEmail.sender = {"email":"no-reply@qrmchat.com","name":"Admin QRM Chat"};
    sendSmtpEmail.to = [{"email":`${to}`,"name":`${name}`}];
    sendSmtpEmail.replyTo = {"email":"no-reply@qrmchat.com","name":"Admin QRM Chat"};
    return apiInstance.sendTransacEmail(sendSmtpEmail)
  }
};

module.exports = EmailService
