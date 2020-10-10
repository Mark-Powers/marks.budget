const fs = require('fs');
const path = require('path');
const handlebars = require("handlebars");

function setUpTemplates(){
    let templates = {};
    
    {
        const templateContent = fs.readFileSync(path.join(__dirname, 'templates/login.html')).toString()
        templates["login"] = handlebars.compile(templateContent);
    }
    {
        const templateContent = fs.readFileSync(path.join(__dirname, 'templates/index.html')).toString()
        // templates["index"] = handlebars.compile(templateContent);
    }
    {
        const templateContent = fs.readFileSync(path.join(__dirname, 'templates/summary.html')).toString()
        templates["summary"] = handlebars.compile(templateContent);
    }

    return templates
}


module.exports = {
    setUpTemplates
};
