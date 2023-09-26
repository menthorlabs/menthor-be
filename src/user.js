const connectionResolver = require('./database');

const fieldsAllowed = [
  'Username',
  'Email',
  'Name',
  'ImageUrl',
  'Tags',
  'Ranks',
  'Badges',
];

const clerkToDb = (clerkUser) => ({
  Id: clerkUser.id,
  Username: clerkUser.username,
  Email: clerkUser.email_addresses[0].email_address,
  Name: `${clerkUser.first_name} ${clerkUser.last_name}` ?? '',
  ImageUrl: clerkUser.image_url,
  Tags: JSON.stringify(clerkUser.private_metadata.tags),
  Ranks: JSON.stringify(clerkUser.private_metadata.ranks),
  Badges: JSON.stringify(clerkUser.private_metadata.badges),
});

// Clerks webhook for create, update and delete user
module.exports.webhook = async (event) => {
  if (event.headers['X-Clerk-Webhook-Key'] !== process.env.CLERK_WEBHOOK_KEY) {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  const body = JSON.parse(event.body);

  if (body.type === 'user.created') {
    const connection = await connectionResolver();

    try {
      const user = clerkToDb(body.data);
      const [rows] = await connection.query('INSERT INTO User SET ?', user);
      // const [count] = await connection.query("SELECT COUNT(*) FROM User");

      // if (count[0]["count(*)"] <= 1000) {
      //   const publicMetadata = {
      //     badges: ["FIRST_1000"],
      //   };

      //   await fetch(`https://api.clerk.com/v1/users/${user.Id}/metadata`, {
      //     method: "PATCH",
      //     headers: {
      //       Authorization: `Bearer ${process.env.CLERK_KEY}`,
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify({
      //       public_metadata: publicMetadata,
      //     }),
      //   });
      // }

      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 200,
        body: JSON.stringify(rows),
      };
    } catch (err) {
      console.error(err);
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 500,
        body: JSON.stringify(err),
      };
    }
  } else if (body.type === 'user.updated') {
    const connection = await connectionResolver();

    try {
      const user = clerkToDb(body.data);

      const fieldsToUpdate = {};

      Object.keys(user).forEach((key) => {
        if (fieldsAllowed.includes(key) && user[key] != null) {
          fieldsToUpdate[key] = user[key];
        }
      });

      const updateQuery = `UPDATE User SET ${Object.keys(fieldsToUpdate)
        .map((key) => `${key} = ?`)
        .join(', ')} WHERE Id = ?`;

      const updateValues = Object.values(fieldsToUpdate);
      updateValues.push(user.Id);

      const [rows] = await connection.query(updateQuery, updateValues);
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 200,
        body: JSON.stringify(rows),
      };
    } catch (err) {
      console.error(err);
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 500,
        body: JSON.stringify(err),
      };
    }
  } else if (body.type === 'user.deleted') {
    const connection = await connectionResolver();

    try {
      const [rows] = await connection.query('DELETE FROM User WHERE Id = ?', [
        body.data.id,
      ]);
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 200,
        body: JSON.stringify(rows),
      };
    } catch (err) {
      console.error(err);
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 500,
        body: JSON.stringify(err),
      };
    }
  } else {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify({}),
    };
  }
};

module.exports.get = async (event) => {
  const { userId } = event.pathParameters;

  const connection = await connectionResolver();
  try {
    const [rows] = await connection.query(
      'SELECT ImageUrl, Name, Tags, Ranks, Badges FROM User WHERE Id = ? or Username = ?',
      [userId, userId],
    );

    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify(rows),
    };
  } catch (err) {
    console.error(err);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};
