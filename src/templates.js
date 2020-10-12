const fs = require('fs');
const path = require('path');
const handlebars = require("handlebars");

function loadTemplate(templates, name, filepath){
    const templateContent = fs.readFileSync(filepath).toString()
    templates[name] = handlebars.compile(templateContent);
}

function setUpTemplates(){
    let templates = {};
    
    loadTemplate(templates, "login", path.join(__dirname, 'templates/login.html'))
    loadTemplate(templates, "ledger", path.join(__dirname, 'templates/ledger.html'))
    loadTemplate(templates, "ledger-edit", path.join(__dirname, 'templates/ledger-edit.html'))
    loadTemplate(templates, "goals", path.join(__dirname, 'templates/goals.html'))
    loadTemplate(templates, "expected", path.join(__dirname, 'templates/expected.html'))
    loadTemplate(templates, "summary", path.join(__dirname, 'templates/summary.html'))

    return templates
}


module.exports = {
    setUpTemplates
};
