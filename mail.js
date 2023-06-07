const Mailgun = require('mailgun-js');

const mailgun = Mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
});

function validateEmail(email) {
  const regex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
  return regex.test(email);
}

module.exports.send = async (event) => {
  const { content, to, subject } = JSON.parse(event.body);
  const emailData = {
    from: 'Menthor <noreply@menthor.io>',
    to: to,
    subject: subject,
    text: content,
  };

  try {
    await mailgun.messages().send(emailData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Email sent successfully',
      }),
    };
  } catch (error) {
    console.error('Error sending email:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error sending email',
        error: error.message,
      }),
    };
  }
};

module.exports.addToMailingList = async (event) => {
  const { email } = JSON.parse(event.body);

  // Validate the email address
  if (!email || !validateEmail(email)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Invalid email address',
      }),
    };
  }

  // Add the email address to the mailing list
  try {
    await mailgun.lists(process.env.MAILGUN_LIST_ADDRESS).members().create({
      address: email,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Email added to the mailing list',
      }),
    };
  } catch (error) {
    console.error('Error adding email to the mailing list:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error adding email to the mailing list',
        error: error.message,
      }),
    };
  }
};

module.exports.sendEmailToMailingList = async (event) => {
  const requestBody = JSON.parse(event.body);

  const subject = requestBody.subject;
  const text = requestBody.text;

  if (!subject || !text) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Invalid subject or text',
      }),
    };
  }

  const emailData = {
    from: 'Menthor <noreply@menthor.io>',
    to: process.env.MAILGUN_LIST_ADDRESS,
    subject: subject,
    text: text,
  };

  try {
    await mailgun.messages().send(emailData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Email sent to the mailing list',
      }),
    };
  } catch (error) {
    console.error('Error sending email to the mailing list:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error sending email to the mailing list',
        error: error.message,
      }),
    };
  }
};
