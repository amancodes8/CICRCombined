// This file centralizes notification logic. To send real notifications,
// you would need to install and configure packages like 'nodemailer' for email
// and 'twilio' for SMS/WhatsApp.

/**
 * Sends an email notification.
 * This is a placeholder that logs to the console.
 * @param {object} options - The email options.
 * @param {string} options.to - The recipient's email address.
 * @param {string} options.subject - The subject of the email.
 * @param {string} options.text - The plain text body of the email.
 */
const sendEmail = async ({ to, subject, text }) => {
    console.log('--- SIMULATING EMAIL NOTIFICATION ---');
    console.log(`Recipient: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${text}`);
    console.log('------------------------------------');

    // REAL IMPLEMENTATION EXAMPLE using Nodemailer:
    // 1. npm install nodemailer
    // 2. Configure a transporter object with your email provider's details.
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    // try {
    //   await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
    //   console.log('Email sent successfully.');
    // } catch (error) {
    //   console.error('Error sending email:', error);
    // }
};

/**
 * Sends a WhatsApp notification.
 * This is a placeholder that logs to the console.
 * @param {string} toNumber The recipient's phone number (in E.164 format, e.g., +919876543210).
 * @param {string} message The message to send.
 */
const sendWhatsAppMessage = async (toNumber, message) => {
    console.log('--- SIMULATING WHATSAPP NOTIFICATION ---');
    console.log(`Recipient: ${toNumber}`);
    console.log(`Message: ${message}`);
    console.log('---------------------------------------');

    // REAL IMPLEMENTATION EXAMPLE using Twilio:
    // 1. npm install twilio
    // 2. Get credentials from your Twilio account and add them to the .env file.
    // const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // try {
    //   await client.messages.create({
    //     body: message,
    //     from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    //     to: `whatsapp:${toNumber}`,
    //   });
    //   console.log('WhatsApp message sent successfully.');
    // } catch (error) {
    //   console.error('Error sending WhatsApp message:', error);
    // }
};

module.exports = {
    sendEmail,
    sendWhatsAppMessage,
};
