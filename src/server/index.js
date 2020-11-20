const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
//const request = require('request');
const crypto = require('crypto');
const uuidv4 = require('uuid/v4');

const path = require('path');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json')));

const server = express();
server.use(cookieParser())
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));

function listen(port) {
    server.listen(port, () => console.info(`Listening: http://localhost:${port} `));
}

function hashWithSalt(password, salt) {
    var hash = crypto.createHmac('sha512', salt);
    hash.update(password);
    return hash.digest("base64");
};

let messages = {}
function putMessage(message, res){
    console.debug("message put", res.locals.id, message)
    messages[res.locals.id] = message;
}
function consumeMessage(res){
    let id = res.locals.id
    if(messages[id]){
        let t = messages[id]
        console.debug("message consume", id, t)
        delete messages[id]
        return t
    } else {
        console.debug("message consume", id, undefined)
        return undefined
    }
}
function dateToString(d){
    return `${d.getFullYear().toString()}/${d.getMonth().toString()}/${d.getDate().toString()}`
}

function setUpRoutes(models, jwtFunctions, database, templates) {
    // Authentication routine
    server.use(async function (req, res, next) {
        let session_cookie = req.cookies.session;
        if (!session_cookie) {
            session_cookie = uuidv4();
            res.cookie('session', session_cookie, { expires: new Date(Date.now() + (1000 * 60 * 60 * 30)) });
        }
        res.locals.id = session_cookie;

        let path = req.path.toLowerCase();
        if(path.startsWith("/static")){
            next();
            return;
        }
        if (!path.startsWith("/login")) {
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

    server.use('/static', express.static(path.join(__dirname, '../static')))
    server.get('/', (req, res) => res.redirect("/ledger"))
    server.get('/about', (req, res) => {
        let name = res.locals.user.username
        let body = templates["about"]({name});
        res.status(200).send(body)
    })
    server.get('/me', (req, res) => {
        let name = res.locals.user.username
        let body = templates["me"]({name, message: consumeMessage(res)});
        res.status(200).send(body)
    })
    server.get('/login', (req, res) => {
        let body = templates["login"]({message: consumeMessage(res)});
        res.status(200).send(body)
    })
    server.get('/logout', (req, res) => {
        putMessage("Logged out", res)
        res.clearCookie('authorization');
        res.redirect("/login");
    });
    server.get('/login/signup', async (req, res) => {
        let body = templates["signup"]({message: consumeMessage(res)});
        res.status(200).send(body)
    })
    server.get('/ledger', async (req, res) => {
        var ledger = await database.query(`SELECT * FROM transactions WHERE username = '${res.locals.user.username}' ORDER BY \`when\` DESC`, { type: database.QueryTypes.SELECT })
        ledger.forEach((element, i) => {
            element.when = dateToString(element.when);
            element.index = i + 1
        });
        let name = res.locals.user.username
        let body = templates["ledger"]({ name, ledger })
        res.status(200).send(body)
    })
    server.get('/ledger/edit/:id', async (req, res) => {
        let ledger = await database.query(`SELECT * FROM transactions WHERE username = '${res.locals.user.username}' and id='${req.params.id}' ORDER BY \`when\` DESC`, { type: database.QueryTypes.SELECT })
        let ledger_item = ledger[0]
        let name = res.locals.user.username
        let body = templates["ledger-edit"]({ name, item: ledger_item })
        res.status(200).send(body)
    })
    server.get('/goals', async (req, res) => {
        let goals = await database.query(`SELECT * FROM goals WHERE username = '${res.locals.user.username}' ORDER BY \`name\` DESC`, { type: database.QueryTypes.SELECT })
        goals.forEach((element, i) => {
            element.remaining = element.total - element.amount;
            element.index = i + 1
        });
        let name = res.locals.user.username
        let body = templates["goals"]({ name, goals })
        res.status(200).send(body)
    })
    server.get(`/expected`, async (req, res, next) => {
        try {
            let expecteds = await database.query(`SELECT * FROM expecteds WHERE username = '${res.locals.user.username}' ORDER BY \`name\` DESC`, { type: database.QueryTypes.SELECT })
            let day_average = 0
            expecteds.forEach((element, i) => {
                element.index = i + 1
                day_average += (element.total / element.days)
            });
            let name = res.locals.user.username
            let week = Math.round(day_average * 7)
            let month = Math.round(day_average * 31)
            let year = Math.round(day_average * 365)
            let body = templates["expected"]({ name, expecteds, week, month, year })
            res.status(200).send(body);
        } catch (e) {
            console.log(e)
            res.status(400).send(e.message);
        }
    })
    const summary = require('./summary');
    summary.setUpRoutes(server, models, jwtFunctions, database, templates);
    
    server.post('/password', async (req, res, next) => {
        const user = await models.users.findOne({ where: { username: res.locals.user.username } })
        const hash = hashWithSalt(req.body.old, user.salt)
        if(hash != user.password){
            putMessage("Old password incorrect", res)
            res.redirect("/me");
        } else if( req.body.new1 != req.body.new2){
            putMessage("New passwords do not match", res)
            res.redirect("/me");
        } else {
            await user.update({password: hash});
            putMessage("Password updated", res);
            res.redirect("/me");
        }
    })
    server.post('/login', async (req, res, next) => {
        const user = await models.users.findOne({ where: { username: req.body.username } })
        const hash = hashWithSalt(req.body.password, user.salt)
        if (!user || user.password != hash) {
            putMessage("Username or password incorrect", res)
            res.redirect('/login');
        } else if (user.password == hash) {
            const token = jwtFunctions.sign(user.username);
            res.cookie('authorization', token, { expires: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)) });
            res.redirect('/ledger');
        }
    })
    server.post('/login/signup', async (req, res) => {
        if(req.body.code != config.signup_code){
            putMessage("Bad code", res)
            res.redirect('/login/signup');
            return;
        }
        const user = await models.users.findOne({ where: { username: req.body.username } })
        if(user){
            putMessage("Username already exists", res)
            res.redirect('/login/signup');
            return;
        }
        let salt = crypto.randomBytes(32).toString("Base64");
        let password = req.body.password
        const hash = hashWithSalt(password, salt)
        let new_user = {
            username: req.body.username,
            password: hash,
            salt: salt
        }
        await models.users.create(new_user);
        putMessage("Account created, please log in")
        res.redirect("/login")
    })
    server.post(`/transaction`, async (req, res, next) => {
        try {
            let item = req.body;
            item.username = res.locals.user.username
            if (!item.when) {
                item.when = new Date().toLocaleDateString();
            }
            await models.transaction.create(item);
            res.redirect("/ledger")
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })
    server.post(`/allocate`, async (req, res, next) => {
        try {
            let amount = req.body.amount;
            var toUpdate = await models.goals.findOne({ where: { name: req.body.name, username: res.locals.user.username } });
            var update = { amount: toUpdate.amount + amount }
            await toUpdate.update(update);
            res.redirect("/goals")
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })
    server.post(`/goals`, async (req, res, next) => {
        try {
            let item = req.body;
            item.username = res.locals.user.username
            item.amount = 0;
            await models.goals.create(item);
            res.redirect("/goals")
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })
    server.post(`/expected`, async (req, res, next) => {
        try {
            let item = req.body;
            item.username = res.locals.user.username
            await models.expected.create(item);
            res.redirect("/expected")
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })
    server.post(`/transaction/:id`, async (req, res, next) => {
        try {
            let id = req.params.id;
            let update = req.body;
            if(update.when.length == 0){
                delete update.when
            }
            var toUpdate = await models.transaction.findOne({ where: { id: id, username:res.locals.user.username } });
            await toUpdate.update(update);
            res.redirect(`/ledger`)
        } catch (e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    })

    server.delete('/ledger/:id', async (req, res) => {
        let id = req.params.id;
        console.log(id, res.locals.user.username)
        await models.transaction.destroy({ where: { id, username: res.locals.user.username } });
        res.redirect('/ledger')
    })
}

module.exports = {
    listen,
    setUpRoutes
};


