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
server.use(bodyParser.urlencoded({ extended: true }));

function listen(port) {
    server.listen(port, () => console.info(`Listening: http://localhost:${port} `));
}

function hashWithSalt(password, salt) {
    var hash = crypto.createHmac('sha512', salt);
    hash.update(password);
    return hash.digest("base64");
};

function setUpRoutes(models, jwtFunctions, database, templates) {
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

    server.use('/static', express.static(path.join(__dirname, '/static')))
    server.get('/', (req, res) => res.redirect("/ledger"))
    server.get('/login', (req, res) => res.sendFile(path.join(__dirname, "/login.html")))
    server.get('/ledger', async (req, res) => {
        var ledger = await database.query(`SELECT * FROM transactions WHERE username = '${res.locals.user.username}' ORDER BY \`when\` DESC`, { type: database.QueryTypes.SELECT })
        ledger.forEach((element, i) => {
            element.when = element.when.toString().substring(0, 10);
            element.index = i + 1
        });
        let name = res.locals.user.username
        let body = templates["ledger"]({ name, ledger })
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
            expecteds.forEach((element, i) => {
                element.index = i + 1
            });
            let name = res.locals.user.username
            let body = templates["expected"]({ name, expecteds })
            res.status(200).send(body);
        } catch (e) {
            console.log(e)
            res.status(400).send(e.message);
        }
    })
    server.get(`/summary`, async (req, res, next) => {
        try {
            let data = {
                week: {
                    out: await database.query(`SELECT year(\`when\`) as y, week(\`when\`) as w, sum(amount) as s FROM transactions where username = '${res.locals.user.username}' and amount > 0 group by year(\`when\`), WEEK(\`when\`);`, { type: database.QueryTypes.SELECT }),
                    in: await database.query(`SELECT year(\`when\`)as y,   week(\`when\`) as w, sum(amount) as s FROM transactions where username = '${res.locals.user.username}' and amount < 0 group by year(\`when\`), WEEK(\`when\`);`, { type: database.QueryTypes.SELECT }),
                    net: await database.query(`SELECT year(\`when\`) as y, week(\`when\`) as w, sum(amount) as s FROM transactions where username = '${res.locals.user.username}' group by year(\`when\`), WEEK(\`when\`);`, { type: database.QueryTypes.SELECT }),
                },
                month: {
                    out: await database.query(`SELECT year(\`when\`) as y, month(\`when\`) as m, sum(amount) as s FROM transactions where username = '${res.locals.user.username}' and amount > 0 group by year(\`when\`), month(\`when\`);`, { type: database.QueryTypes.SELECT }),
                    in: await database.query(`SELECT year(\`when\`)  as y, month(\`when\`) as m, sum(amount) as s FROM transactions where username = '${res.locals.user.username}' and amount < 0 group by year(\`when\`), month(\`when\`);`, { type: database.QueryTypes.SELECT }),
                    net: await database.query(`SELECT year(\`when\`) as y, month(\`when\`) as m, sum(amount) as s FROM transactions where username = '${res.locals.user.username}' group by year(\`when\`), month(\`when\`);`, { type: database.QueryTypes.SELECT }),
                },
                year: {
                    out: await database.query(`SELECT year(\`when\`) as y, sum(amount) as s FROM transactions where username = '${res.locals.user.username}' and amount > 0 group by year(\`when\`);`, { type: database.QueryTypes.SELECT }),
                    in: await database.query(`SELECT year(\`when\`)  as y, sum(amount) as s FROM transactions where username = '${res.locals.user.username}' and amount < 0 group by year(\`when\`);`, { type: database.QueryTypes.SELECT }),
                    net: await database.query(`SELECT year(\`when\`) as y, sum(amount) as s FROM transactions where username = '${res.locals.user.username}' group by year(\`when\`);`, { type: database.QueryTypes.SELECT }),
                },
                name: res.locals.user.username
            };
            data = formatSummary(data)
            let body = templates["summary"](data)
            res.status(200).send(body);

        } catch (e) {
            console.log(e)
            res.status(400).send(e.message);
        }
    })


    server.post('/login', async (req, res, next) => {
        const user = await models.users.findOne({ where: { username: req.body.username } })
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
    server.post(`/transaction`, async (req, res, next) => {
        try {
            let item = req.body;
            console.log(item);
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
}

var findOrCreateWeek = function (summary, el) {
    var item = summary.week.find(el2 => {
        return el.y == el2.y && el.w == el2.w
    })
    if (!item) {
        item = { y: el.y, w: el.w, in: 0, out: 0, net: 0 }
        summary.week.push(item);
    }
    return item
}
var findOrCreateMonth = function (summary, el) {
    var item = summary.month.find(el2 => {
        return el.y == el2.y && el.m == el2.m
    })
    if (!item) {
        item = { y: el.y, m: el.m, in: 0, out: 0, net: 0 }
        summary.month.push(item);
    }
    return item
}
var findOrCreateYear = function (summary, el) {
    var item = summary.year.find(el2 => {
        return el.y == el2.y
    })
    if (!item) {
        item = { y: el.y, in: 0, out: 0, net: 0 }
        summary.year.push(item);
    }
    return item
}

function formatSummary(response) {
    let summary = {}
    summary.week = [];
    summary.month = [];
    summary.year = [];

    response.week.in.forEach(el => {
        findOrCreateWeek(summary, el).in = Math.abs(el.s)
    })
    response.week.out.forEach(el => {
        findOrCreateWeek(summary, el).out = Math.abs(el.s)
    })
    response.week.net.forEach(el => {
        var item = findOrCreateWeek(summary, el);
        item.net = el.s
        // Note we flip these since income is negative
        item.classes = ""
        if(el.s > 0){
            item.classes += "net-negative"
        }
        if(el.s < 0){
            item.classes += "net-positive"
        }
    })

    response.month.in.forEach(el => {
        findOrCreateMonth(summary, el).in = Math.abs(el.s)
    })
    response.month.out.forEach(el => {
        findOrCreateMonth(summary, el).out = Math.abs(el.s)
    })
    response.month.net.forEach(el => {
        var item = findOrCreateMonth(summary, el);
        item.net = el.s
        // Note we flip these since income is negative
        item.classes = ""
        if(el.s > 0){
            item.classes += "net-negative"
        }
        if(el.s < 0){
            item.classes += "net-positive"
        }
    })

    response.year.in.forEach(el => {
        findOrCreateYear(summary, el).in = Math.abs(el.s)
    })
    response.year.out.forEach(el => {
        findOrCreateYear(summary, el).out = Math.abs(el.s)
    })
    response.year.net.forEach(el => {
        var item = findOrCreateYear(summary, el);
        item.net = el.s
        // Note we flip these since income is negative
        item.classes = ""
        if(el.s > 0){
            item.classes += "net-negative"
        }
        if(el.s < 0){
            item.classes += "net-positive"
        }
    })

    summary.week.sort(function (a, b) {
        if (a.y == b.y) { return a.w - b.w; }
        return a.y - b.y;
    })
    summary.month.sort(function (a, b) {
        if (a.y == b.y) { return a.m - b.m; }
        return a.y - b.y;
    })
    summary.year.sort(function (a, b) {
        return a.y - b.y;
    })

    summary.name = response.name
    return summary
}

module.exports = {
    listen,
    setUpRoutes
};


