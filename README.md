# marks.budget

## Usage
Manage your personal budget with this site. You can track a ledger of expenses, goals, and recurring expected expenses. A summary view breaks down differences weekly, monthly, and yearly. 

## Installation
Download the repository, run `npm install`, set up a mysql server with a user and a database, 
fill out a `config.json` file as specified below, and then `npm run run`. 

`config.json` should be of the following form
```
{
    "database": {
        "host": "<DB_HOST>",
        "user": "<DB_USER>",
        "database": "<DB_NAME>",
        "password": "<PASSWORD>"
    },
    "port": <PORT_TO_RUN_WEBSERVER_ON>
}

```
## TODO
- Add expected summary (maybe in /summary? compare to averages?)
    - add rolling category values (grocery last month, last year, all time)
- Add graphs
- Add initial balance somewhere
- Add assets/liabilities?
