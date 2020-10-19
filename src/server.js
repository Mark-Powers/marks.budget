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
        let path = req.path.toLowerCase();
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

    server.use('/static', express.static(path.join(__dirname, '/static')))
    server.get('/', (req, res) => res.redirect("/ledger"))
    server.get('/about', (req, res) => {
        let body = templates["about"]({});
        res.status(200).send(body)
    })
    server.get('/login', (req, res) => {
        let body = templates["login"]({});
        res.status(200).send(body)
    })
    server.get('/login/signup', async (req, res) => {
        let body = templates["signup"]({});
        res.status(200).send(body)
    })
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
                day_average = element.total / element.days
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
    server.get(`/summary`, async (req, res, next) => {
        try {
            let data = await formatSummary(database, res.locals.user.username)
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
            res.redirect('/ledger');
        } else {
            console.debug("Redirecting to login - invalid login")
            res.redirect('/login');
        }
    })
    server.post('/login/signup', async (req, res) => {
        if(req.body.code != config.signup_code){
            console.debug("Redirecting to signup - bad code")
            res.redirect('/login/signup');
            return;
        }
        const user = await models.users.findOne({ where: { username: req.body.username } })
        if(user){
            console.debug("Redirecting to signup - user already exists")
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
        console.debug("Created account - log in")
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

async function formatSummary(database, username) {
    let response = {
        week: {
            out: await database.query(`SELECT year(\`when\`) as y, week(\`when\`) as w, sum(amount) as s FROM transactions where username = '${username}' and amount > 0 group by year(\`when\`), WEEK(\`when\`);`, { type: database.QueryTypes.SELECT }),
            in: await database.query(`SELECT year(\`when\`)as y,   week(\`when\`) as w, sum(amount) as s FROM transactions where username = '${username}' and amount < 0 group by year(\`when\`), WEEK(\`when\`);`, { type: database.QueryTypes.SELECT }),
            net: await database.query(`SELECT year(\`when\`) as y, week(\`when\`) as w, sum(amount) as s FROM transactions where username = '${username}' group by year(\`when\`), WEEK(\`when\`);`, { type: database.QueryTypes.SELECT }),
        },
        month: {
            out: await database.query(`SELECT year(\`when\`) as y, month(\`when\`) as m, sum(amount) as s FROM transactions where username = '${username}' and amount > 0 group by year(\`when\`), month(\`when\`);`, { type: database.QueryTypes.SELECT }),
            in: await database.query(`SELECT year(\`when\`)  as y, month(\`when\`) as m, sum(amount) as s FROM transactions where username = '${username}' and amount < 0 group by year(\`when\`), month(\`when\`);`, { type: database.QueryTypes.SELECT }),
            net: await database.query(`SELECT year(\`when\`) as y, month(\`when\`) as m, sum(amount) as s FROM transactions where username = '${username}' group by year(\`when\`), month(\`when\`);`, { type: database.QueryTypes.SELECT }),
        },
        year: {
            out: await database.query(`SELECT year(\`when\`) as y, sum(amount) as s FROM transactions where username = '${username}' and amount > 0 group by year(\`when\`);`, { type: database.QueryTypes.SELECT }),
            in: await database.query(`SELECT year(\`when\`)  as y, sum(amount) as s FROM transactions where username = '${username}' and amount < 0 group by year(\`when\`);`, { type: database.QueryTypes.SELECT }),
            net: await database.query(`SELECT year(\`when\`) as y, sum(amount) as s FROM transactions where username = '${username}' group by year(\`when\`);`, { type: database.QueryTypes.SELECT }),
        },
    };
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
        item.net = Number(el.s)
        item.classes = getClass(el.s)
    })

    response.month.in.forEach(el => {
        findOrCreateMonth(summary, el).in = Math.abs(el.s)
    })
    response.month.out.forEach(el => {
        findOrCreateMonth(summary, el).out = Math.abs(el.s)
    })
    response.month.net.forEach(el => {
        var item = findOrCreateMonth(summary, el);
        item.net = Number(el.s)
        item.classes = getClass(el.s)
    })

    response.year.in.forEach(el => {
        findOrCreateYear(summary, el).in = Math.abs(el.s)
    })
    response.year.out.forEach(el => {
        findOrCreateYear(summary, el).out = Math.abs(el.s)
    })
    response.year.net.forEach(el => {
        var item = findOrCreateYear(summary, el);
        item.net = Number(el.s)
        item.classes = getClass(el.s)
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
    summary.year_avg = getBudgetAverage(summary.year)
    summary.month_avg = getBudgetAverage(summary.month)
    summary.week_avg = getBudgetAverage(summary.week)


    summary.categories = await database.query(`select category, sum(amount) as s from transactions where username = '${username}' and category <> '' group by category`, { type: database.QueryTypes.SELECT });
    summary.subcategories = await database.query(`select subcategory, sum(amount) as s from transactions where username = '${username}' and subcategory <> '' group by subcategory`, { type: database.QueryTypes.SELECT });
    summary.name = username
    return summary
}

function getBudgetAverage(list){
    let avg = { out: 0, in: 0, net: 0}
    list.forEach(item => {
        avg.out += item.out
        avg.in += item.in
        avg.net += item.net
    })
    avg.out = Math.round(avg.out / list.length)
    avg.in = Math.round(avg.in / list.length)
    avg.net = Math.round(avg.net / list.length)
    avg.classes = getClass(avg.net)
    return avg;
}

function getClass(value){
    if(value > 0){
        return "net-negative"
    }
    if(value < 0){
        return "net-positive"
    }
    return ""
}


module.exports = {
    listen,
    setUpRoutes
};


