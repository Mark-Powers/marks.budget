const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
//const request = require('request');
const crypto = require('crypto');

const path = require('path');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));

const server = express();
server.use(cookieParser())
server.use(bodyParser.json());
//server.use(bodyParser.urlencoded({ extended: true }));

function listen(port) {
    server.listen(port, () => console.info(`Listening: http://localhost:${port} `));
}

function hashWithSalt(password, salt){
    var hash = crypto.createHmac('sha512', salt);
    hash.update(password);
    return hash.digest("base64");
};

function setUpRoutes(models, jwtFunctions, database) {
    // Authentication routine
    server.use(async function (req, res, next) {
        if (!req.path.toLowerCase().startsWith("/login")) {
            let cookie = req.cookies.authorization
            if (!cookie) {
                console.debug("Redirecting to login - no cookie")
                res.redirect('/login');
                return;
            }
            try {
                const decryptedUserId = jwtFunctions.verify(cookie);
                var user = await models.users.findOne({ where: { username: decryptedUserId } });
                if (user) {
                    res.locals.user = user.get({ plain: true });
                } else {
                    console.debug("Redirecting to login - invalid cookie")
                    res.redirect('/login');
                    return;
                }
            } catch (e) {
                res.status(400).send(e.message);
            }
        }
        next();
    })
    
    // Route logging
    server.use(function (req, res, next) {
        console.debug(new Date(), req.method, req.originalUrl);
        next()
    })

    server.get('/', (req, res) => res.sendFile(__dirname + "/index.html"))
    server.get('/login', (req, res) => res.sendFile(__dirname + "/login.html"))
    server.get('/styles.css', (req, res) => res.sendFile(__dirname + "/styles.css"))
    server.get('/main.js', (req, res) => res.sendFile(__dirname + "/main.js"))

    server.post('/login', async (req, res, next) => {
        const user = await models.users.findOne({ where: { username: req.body.username} })
        const hash = hashWithSalt(req.body.password, user.salt)
        if (user.password == hash) {
            const token = jwtFunctions.sign(user.username);
            res.cookie('authorization', token, { expires: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)) });
            console.debug("Redirecting to page - logged in")
            res.redirect('/');
        } else {
            console.debug("Redirecting to login - invalid login")
            res.redirect('/login');
        }
    })

    server.get(`/transaction`, async (req, res, next) => {
        try {
            var result = await database.query("SELECT * FROM transactions WHERE username = '" + res.locals.user.username + "' ORDER BY `when` DESC", { type: database.QueryTypes.SELECT })
            res.status(200).send(result);
            next();
        } catch (e) {
            console.log(e)
            res.status(400).send(e.message);
        }
    })
    server.post(`/transaction`, async (req, res, next) => {
        try {
            let item = req.body;
            console.log(item);
            item.username = res.locals.user.username
            await models.transaction.create(item);
            var result = await database.query("SELECT * FROM transactions WHERE username = '" + res.locals.user.username + "' ORDER BY `when` DESC", { type: database.QueryTypes.SELECT })
            res.status(200).send(result);
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })
    server.delete(`/transaction`, async (req, res, next) => {
        try {
            let id = req.body.id;
            console.log(`Deleting ${id}`);
            await models.transaction.destroy({ where: { id: id, username: res.locals.user.username } });
            var result = await database.query("SELECT * FROM transactions WHERE username = '" + res.locals.user.username + "' ORDER BY `when` DESC", { type: database.QueryTypes.SELECT })
            res.status(200).send(result);
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })
    server.put(`/transaction`, async (req, res, next) => {
        try {
            let id = req.body.id;
            let update = req.body.update;
            console.log(`Updating ${id}`);
            var toUpdate = await models.transaction.findOne({ where: { id: id, username:res.locals.user.username } });
            console.log(toUpdate)
            console.log(update)
            await toUpdate.update(update);
            var result = await database.query("SELECT * FROM transactions WHERE username = '" + res.locals.user.username + "' ORDER BY `when` DESC", { type: database.QueryTypes.SELECT })
            res.status(200).send(result);
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })
    server.get(`/goals`, async (req, res, next) => {
        try {
            var result = await database.query("SELECT * FROM goals WHERE username = '" + res.locals.user.username + "' ORDER BY `name` DESC", { type: database.QueryTypes.SELECT })
            res.status(200).send(result);
            next();
        } catch (e) {
            console.log(e)
            res.status(400).send(e.message);
        }
    })
    server.post(`/goals`, async (req, res, next) => {
        try {
            let item = req.body;
            console.log(item);
            item.username = res.locals.user.username
            await models.goals.create(item);
            var result = await database.query("SELECT * FROM goals WHERE username = '" + res.locals.user.username + "' ORDER BY `name` DESC", { type: database.QueryTypes.SELECT })
            res.status(200).send(result);
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })
    server.post(`/allocate`, async (req, res, next) => {
        try {
            let name = req.body.name;
            let amount = req.body.amount;
            var toUpdate = await models.goals.findOne({ where: { name: name, username:res.locals.user.username } });
            var update = {amount: toUpdate.amount + amount}
            await toUpdate.update(update);
            var result = await await database.query("SELECT * FROM goals WHERE username = '" + res.locals.user.username + "' ORDER BY `name` DESC", { type: database.QueryTypes.SELECT })
            res.status(200).send(result);
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })
    server.get(`/summary`, async (req, res, next) => {
        try {
            res.status(200).send({
                week: {
                    out: await database.query("SELECT year(`when`) as y, week(`when`) as w, sum(amount) as s FROM transactions where username = '" + res.locals.user.username + "' and amount > 0 group by year(`when`), WEEK(`when`);", { type: database.QueryTypes.SELECT }),
                    in: await database.query("SELECT year(`when`)as y,   week(`when`) as w, sum(amount) as s FROM transactions where username = '" + res.locals.user.username + "' and amount < 0 group by year(`when`), WEEK(`when`);", { type: database.QueryTypes.SELECT }),
                    net: await database.query("SELECT year(`when`) as y, week(`when`) as w, sum(amount) as s FROM transactions where username = '" + res.locals.user.username + "' group by year(`when`), WEEK(`when`);", { type: database.QueryTypes.SELECT }),
                },
                month: {
                    out: await database.query("SELECT year(`when`) as y, month(`when`) as m, sum(amount) as s FROM transactions where username = '" + res.locals.user.username + "' and amount > 0 group by year(`when`), month(`when`);", { type: database.QueryTypes.SELECT }),
                    in: await database.query("SELECT year(`when`)  as y, month(`when`) as m, sum(amount) as s FROM transactions where username = '" + res.locals.user.username + "' and amount < 0 group by year(`when`), month(`when`);", { type: database.QueryTypes.SELECT }),
                    net: await database.query("SELECT year(`when`) as y, month(`when`) as m, sum(amount) as s FROM transactions where username = '" + res.locals.user.username + "' group by year(`when`), month(`when`);", { type: database.QueryTypes.SELECT }),
                },
                year: {
                    out: await database.query("SELECT year(`when`) as y, sum(amount) as s FROM transactions where username = '" + res.locals.user.username + "' and amount > 0 group by year(`when`);", { type: database.QueryTypes.SELECT }),
                    in: await database.query("SELECT year(`when`)  as y, sum(amount) as s FROM transactions where username = '" + res.locals.user.username + "' and amount < 0 group by year(`when`);", { type: database.QueryTypes.SELECT }),
                    net: await database.query("SELECT year(`when`) as y, sum(amount) as s FROM transactions where username = '" + res.locals.user.username + "' group by year(`when`);", { type: database.QueryTypes.SELECT }),
                },
                username: res.locals.user.username
            });
            next();
        } catch (e) {
            console.log(e)
            res.status(400).send(e.message);
        }
    })
}

module.exports = {
    listen,
    setUpRoutes
};


