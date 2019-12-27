# marks.budget

# Installation
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
