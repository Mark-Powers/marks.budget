const fs = require('fs');
const path = require('path');
const handlebars = require("handlebars");

function loadTemplate(templates, name, filepath){
    const templateContent = fs.readFileSync(filepath).toString()
    templates[name] = handlebars.compile(templateContent);
}

function loadPartial(name, filepath){
    handlebars.registerPartial(name, fs.readFileSync(filepath).toString());
}

function setUpTemplates(){
    loadPartial("navigation", path.join(__dirname, "templates/navigation.html"))
    loadPartial("message", path.join(__dirname, "templates/message.html"))

    let templates = {};
    loadTemplate(templates, "me", path.join(__dirname, 'templates/me.html'))
    loadTemplate(templates, "about", path.join(__dirname, 'templates/about.html'))
    loadTemplate(templates, "login", path.join(__dirname, 'templates/login.html'))
    loadTemplate(templates, "signup", path.join(__dirname, 'templates/sign-up.html'))
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
