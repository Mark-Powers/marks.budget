const Sequelize = require('sequelize');
function setUpModels(database) {
    const models = {
        "transaction": database.define('transaction', {
            when: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            amount: {
                type: Sequelize.DECIMAL,
                allowNull: false,
            },
            where: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            category: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            subcategory: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
        }),
        "goals": database.define('goal', {
            username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            total: {
                type: Sequelize.DECIMAL,
                allowNull: false,
            },
            amount: {
                type: Sequelize.DECIMAL,
                allowNull: false,
            }
        }),
        "expected": database.define('expected', {
            username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            total: {
                type: Sequelize.DECIMAL,
                allowNull: false,
            },
            days: {
                type: Sequelize.INTEGER,
                allowNull: false,
            }
        }),
        "users": database.define('user', {
            username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            password: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            salt: {
                type: Sequelize.STRING,
                allowNull: false,
            },
        }),
    }
    return models;
}
module.exports = {
    setUpModels
}