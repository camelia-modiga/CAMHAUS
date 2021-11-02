const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const session = require('express-session');
const fs = require('fs');

const port = 6789;

const app = express();
app.use(session({ secret: 'ssshhhhh', saveUninitialized: false, resave: false, }));
app.use(cookieParser());

app.set('view engine', 'ejs');
app.use(expressLayouts);
app.use(express.static('public'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var RateLimit = require('express-rate-limit');

app.enable('trust proxy');
var createAccountLimiter = new RateLimit({
    windowMs: 3 * 60 * 1000,
    max: 5,
    message: "Too many requests, please try again later"
});
//var contor = 0;

var sess;

var mysql = require('mysql');

var con = mysql.createConnection({
    host: "localhost",
    user: "cami",
    password: "cami",
    insecureAuth: true,
    database: 'cumparaturi'
});

con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});


var BLACKLIST = [];

var getClientIp = function(req) {
    var ipAddress = req.connection.remoteAddress;
    if (!ipAddress) {
        return '';
    }
    return ipAddress;
};


app.use(function(req, res, next) {
    var ipAddress = getClientIp(req);
    if (BLACKLIST.indexOf(ipAddress) === -1) {
        next();
    } else {
        res.send(ipAddress + ' Resursă invalidă!!')
    }
});


app.get('/', function(req, res) {
    var sql = 'SELECT * FROM produse';
    con.query(sql, function(err, data, fields) {
        if (err) throw err;
        if (req.session.username != null) {
            res.render('index', { mesaj: req.cookies.utilizator, log: req.session.username, listResults: data });
            return;
        } else {

            res.render('index', { mesaj: req.cookies.utilizator, log: ' ', listResults: data });
        }
    });

    // console.log(req.session.username);
    //res.render('index', { mesaj: req.cookies.utilizator, log: ' ', listResults: ' ' });
});


app.get('/chestionar', (req, res) => {
    fs.readFile("intrebari.json", (err, data) => {
        if (err) {
            console.log(err);
        }
        const listaIntrebari = JSON.parse(data);
        res.render('chestionar', { intrebari: listaIntrebari });
    });
});


app.post('/rezultat-chestionar', (req, res) => {
    var raspunsuri = req.body;
    //console.log(raspunsuri);
    var count = 0;
    fs.readFile("intrebari.json", (err, data) => {
        if (err) {
            console.log(err);
        }
        const listaIntrebari = JSON.parse(data);
        for (var i = 0; i < listaIntrebari.length; i++) {

            if (raspunsuri[i] == ("\r\n                " + listaIntrebari[i].variante[listaIntrebari[i].corect])) {
                count++;
            }
        }
        res.render('rezultat-chestionar', { answer: count });

    });
});


app.get('/autentificare', createAccountLimiter, function(req, res) {
    sess = req.session.username;
    //console.log(sess);
    res.clearCookie('mesajEroare', 'Date gresite!!');
    res.clearCookie('utilizator', req.session.username);
    res.render('autentificare', { mesaj: req.cookies['mesajEroare'], utilLogat: req.session.username });
});


app.post('/verificare-autentificare', (req, res) => {

    const username = req.body.username;
    const pass = req.body.parola;
    sess = req.session;
    //sess.username = req.body.username;
    //console.log(sess.username);
    fs.readFile('utilizatori.json', (err, data) => {
        if (err) {
            console.log(err);
        }
        const listaUtilizatori = JSON.parse(data);
        var ok = 0;
        for (var i = 0; i < listaUtilizatori.length; i++) {
            if (listaUtilizatori[i].utilizator == username && listaUtilizatori[i].parola == pass) {
                ok = 1;
                //res.clearCookie('mesajEroare', 'Date gresite!!');
                sess.username = listaUtilizatori[i].utilizator;
                sess.numeUtilizator = listaUtilizatori[i].nume;
                sess.prenume = listaUtilizatori[i].prenume;
                //console.log(sess);
                //console.log(sess.username);
                res.cookie('utilizator', username);
                res.redirect(302, '/');
                res.end();
            }
        }
        if (username == 'admin' && pass == 'admin123') {
            ok = 1;
            sess.username = 'admin';
            res.cookie('utilizator', username);
            res.redirect(302, '/admin');
            res.end();
        }
        if (ok == 0) {
            // contor++;
            res.cookie('mesajEroare', 'Date gresite!!');
            res.redirect(302, '/autentificare');
            res.end();
        }
        //console.log(contor);
    });
});


app.get('/delogare', (req, res) => {
    res.cookie('utilizator', '', { maxAge: 0 });
    req.session.username = null;
    prod = [];
    nume_prod = [];
    req.session.produse = undefined;
    res.redirect(302, '/');
});


app.get('/creare-bd', (req, res) => {

    con.query("CREATE DATABASE IF NOT EXISTS cumparaturi", function(err, result) {
        if (err) throw err;
        console.log("Database created");

    });

    var sql = "CREATE TABLE IF NOT EXISTS produse  (nume_produs VARCHAR(50), pret_produs INT)";
    con.query(sql, function(err, result) {
        if (err) throw err;
        console.log("Table created");
    });


    res.redirect(302, '/');
});

app.get('/inserare-bd', (req, res) => {

    var sql = "insert into produse  (nume_produs,pret_produs) VALUES ?";
    var values = [
        ['Burghiu pentru metal, HSS DIN 338, 3.5 x 70', 5],
        ['Disc de taiere multimaterial, 230 x 1.6 mm', 6],
        ['Rigle rindeluite din lemn, 42 x 70 mm, 3 m', 27],
        ['Cheie tubulara hexagonala, Topex, ½, 32mm', 14],
        ['Slefuitor cu banda Raider RDP-BS07, 1010 W', 331],
        ['Pistol vopsit PFS 1000 BOSCH', 269]
    ];
    con.query(sql, [values], function(err, result) {
        if (err) throw err;
        console.log("Number of records inserted: " + result.affectedRows);
    });
    res.redirect(302, '/');

});

var prod = [];
var nume_prod = [];
app.post('/adaugare-cos', (req, res) => {

    prod.push(req.body.id);
    nume_prod.push(req.body.prod);
    req.session.produse = prod;
});


app.get('/vizualizare-cos', (req, res) => {
    res.render('vizualizare-cos', { produse: nume_prod });
});

app.get('/admin', (req, res) => {

    res.render('admin');
});

app.post('/admin', (req, res) => {
    var produsnou = req.body.name;
    var pretnou = req.body.pret;
    //console.log(produsnou);
    //console.log(pretnou);
    if (produsnou != null && pretnou != null) {
        var sql = "insert into produse  (nume_produs,pret_produs) VALUES (?,?)";
        con.query(sql, [produsnou, pretnou], function(err, result) {
            if (err) throw err;
            console.log("Number of records inserted: " + result.affectedRows);
        });
    }
    res.redirect(302, '/admin');
});

app.get('*', function(req, res) {
    var ipAddress = getClientIp(req);
    BLACKLIST.push(ipAddress);
    setTimeout(function() { BLACKLIST = []; }, 8000);
    res.send('what???', 404);
});

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:`));