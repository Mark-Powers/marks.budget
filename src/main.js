window.onload = function () {
    var transactionData = new Vue({
        el: '#data',
        data: {
            activeTab: "ledger",
            transactions: [],
            summary: {username : ""},
            selTodoType: "all",
            total_to_allocate: 0,
            goals: [],
            expected: []
        },
        methods: {
            setTab: function (value) {
                this.activeTab = value;
            },
            clearData: function () {
                this.m = {
                    when: new Date().toLocaleDateString(),
                    where: "",
                    amount: "",
                    category: "",
                    subcategory: "",
                }
                this.em = {
                    when: new Date().toLocaleDateString(),
                    where: "",
                    amount: "",
                    category: "",
                    subcategory: "",
                }
                this.ng = {
                    name: "",
                    total: "",
                    amount: 0
                }
                this.e = {
                    name: "",
                    total: "",
                    days: 7
                }
                this.na = {
                    selected: "",
                    amount: ""
                }
            },
            requestThenUpdate: function (request, app, field) {
                fetch(request)
                    .then(response => response.json())
                    .then(response => {
                        app[field] = response
                    });
            },
            post: function (obj, path, save_to) {
                console.log(obj);
                console.log(path);
                this.requestThenUpdate(new Request(path, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(obj)
                }), this, save_to);
                this.clearData();
            },
            remove: function (obj, save_to) {
                if (confirm(`Delete transaction?`)) {
                    this.requestThenUpdate(new Request("/transaction", {
                        method: 'delete',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(obj)
                    }), this, save_to)
                }
            },
            prepareEntryEdit: function(transaction){
                this.em.id=transaction.id;
                this.em.where=transaction.where;
                this.em.when=transaction.when;
                this.em.amount=transaction.amount;
                this.em.category=transaction.category;
                this.em.subcategory=transaction.subcategory;
                this.activeTab='ledger-edit';
            },
            updateMany: function (obj, save_to) {
                update = {}
                update = obj;
                this.requestThenUpdate(new Request("/transaction", {
                    method: 'put',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id: obj.id, update: update })
                }),  this, save_to)
            },
        },
        created() {
            this.clearData();
            fetch(new Request(`/expected`)).then(response => response.json())
                .then(response => this.expected = response);
            fetch(new Request(`/goals`)).then(response => response.json())
                .then(response => this.goals = response);
            fetch(new Request(`/transaction`)).then(response => response.json())
                .then(response => this.transactions = response);
            fetch(new Request(`/summary`)).then(response => response.json())
                .then(response => {
                    var findOrCreateWeek = function(t, el){
                        var item = t.summary.week.find( el2 => {
                            return el.y == el2.y && el.w == el2.w
                        })
                        if(!item){
                            item = {y : el.y, w : el.w, in: 0, out: 0, net: 0}
                            t.summary.week.push(item);
                        }
                        return item
                    }
                    var findOrCreateMonth = function(t, el){
                        var item = t.summary.month.find( el2 => {
                            return el.y == el2.y && el.m == el2.m
                        })
                        if(!item){
                            item = {y : el.y, m : el.m, in: 0, out: 0, net: 0}
                            t.summary.month.push(item);
                        }
                        return item
                    }
                    var findOrCreateYear = function(t, el){
                        var item = t.summary.year.find( el2 => {
                            return el.y == el2.y
                        })
                        if(!item){
                            item = {y : el.y, in: 0, out: 0, net: 0}
                            t.summary.year.push(item);
                        }
                        return item
                    }

                    this.summary.week = [];
                    this.summary.month = [];
                    this.summary.year = [];

                    response.week.in.forEach(el => {
                        findOrCreateWeek(this, el).in = Math.abs(el.s)
                    })
                    response.week.out.forEach(el => {
                        findOrCreateWeek(this, el).out = Math.abs(el.s)
                    })
                    response.week.net.forEach(el => {
                        var item = findOrCreateWeek(this, el);
                        item.net = el.s
                        // Note we flip these since income is negative
                        item.negative = el.s > 0
                        item.positive = el.s < 0
                    })

                    response.month.in.forEach(el => {
                        findOrCreateMonth(this, el).in = Math.abs(el.s)
                    })
                    response.month.out.forEach(el => {
                        findOrCreateMonth(this, el).out = Math.abs(el.s)
                    })
                    response.month.net.forEach(el => {
                        var item = findOrCreateMonth(this, el);
                        item.net = el.s
                        // Note we flip these since income is negative
                        item.negative = el.s > 0
                        item.positive = el.s < 0
                    })

                    response.year.in.forEach(el => {
                        findOrCreateYear(this, el).in = Math.abs(el.s)
                    })
                    response.year.out.forEach(el => {
                        findOrCreateYear(this, el).out = Math.abs(el.s)
                    })
                    response.year.net.forEach(el => {
                        var item = findOrCreateYear(this, el);
                        item.net = el.s
                        // Note we flip these since income is negative
                        item.negative = el.s > 0
                        item.positive = el.s < 0
                        
                        // -= since its flipped
                        this.total_to_allocate -= item.net
                    })
                    this.goals.forEach(el => {
                        this.total_to_allocate -= el.amount
                    })

                    this.summary.week.sort(function(a, b){
                        if ( a.y == b.y ){ return a.w - b.w; }
                        return a.y-b.y;
                    })
                    this.summary.month.sort(function(a, b){
                        if ( a.y == b.y ){ return a.m - b.m; }
                        return a.y-b.y;
                    })
                    this.summary.year.sort(function(a, b){
                        return a.y-b.y;
                    })
                    
                    seriesX = this.summary.month.map(el => el.y)


                    this.summary.username = response.username
                });
        },
        computed: {
            
        }
    });
}