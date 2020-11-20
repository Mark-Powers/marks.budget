
function setUpRoutes(server, models, jwtFunctions, database, templates) {
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
    setUpRoutes
}