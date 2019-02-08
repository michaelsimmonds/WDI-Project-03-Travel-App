require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const routes = require('./config/routes')

const app = express()

mongoose.connect('mongodb://localhost/Project-4')

app.use(bodyParser.json())

app.use(routes)

app.listen(4000, () => console.log('Express is running on port 4000'))
