const server = require('./server');
const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));

const dbCreds = config.database;

const database = new Sequelize(dbCreds.database, dbCreds.user, dbCreds.password, {
  logging(str) {
    console.debug(`DB:${str}`);
  },
  dialectOptions: {
    charset: 'utf8mb4',
    multipleStatements: true,
  },
  //   host: dbCreds.host,
  dialect: 'mysql',
  pool: {
    max: 5,
    min: 0,
    idle: 10000,
  },
});

database.authenticate().then(() => {
  console.debug(`database connection successful: ${dbCreds.database}`);
}, (e) => console.log(e));

async function sync(alter, force, callback) {
  await database.sync({ alter, force, logging: console.log });
}

function setUpModels() {
  const models = {
    "transaction": database.define('transaction', {
      when: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL,
        allowNull: false,
      },
      where: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      subcategory: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    }),
    "users": database.define('user', {
      username: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      salt: {
        type: Sequelize.STRING,
        allowNull: false,
      },}),
  }
  return models;
}

const models = setUpModels();
sync();

function hashWithSalt(password, salt){
  var hash = crypto.createHmac('sha512', salt);
  hash.update(password);
  return hash.digest("base64");
};

const readline = require('readline-sync');
let username = readline.question("New username: ");
let password = readline.question("New password: ");
let salt = crypto.randomBytes(32).toString("Base64");
console.log("Salt", salt);
let hash = hashWithSalt(password, salt)
console.log("Hash", hash);
var newUser ={
  "username": username, 
  "password": hash,
  "salt": salt
}
models.users.create(newUser).then(e =>{
  console.log("done")
  console.log(e);
})
