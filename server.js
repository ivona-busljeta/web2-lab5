const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const fse = require('fs-extra');
const webpush = require('web-push');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/record', function (req, res) {
    res.render('record');
});

const UPLOAD_PATH = path.join(__dirname, 'public', 'uploads');
const uploadPosts = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, UPLOAD_PATH);
        },
        filename: function (req, file, cb) {
            let fn = file.originalname.replaceAll(':', '-');
            cb(null, fn);
        },
    })
}).single('audio');

app.post('/savePost', function (req, res) {
    uploadPosts(req, res, async function(err) {
        if (err) {
            console.log(err);
            res.json({
                success: false,
                error: {
                    message: 'Upload failed:: ' + JSON.stringify(err)
                }
            });
        } else {
            console.log(req.body);
            res.json({ success: true, id: req.body.id });
            await sendPushNotifications(req.body.title);
        }
    });
});

app.get('/posts', function (req, res) {
    let files = fse.readdirSync(UPLOAD_PATH);
    files = files.reverse().slice(0, 10);
    res.json({
        files
    });
});

let subscriptions = [];
const SUBS_FILENAME = 'subscriptions.json';
try {
    subscriptions = JSON.parse(fs.readFileSync(SUBS_FILENAME));
} catch (error) {
    console.error(error);
}

app.post('/saveSubscription', function(req, res) {
    console.log(req.body);
    let sub = req.body.sub;
    subscriptions.push(sub);
    fs.writeFileSync(SUBS_FILENAME, JSON.stringify(subscriptions));
    res.json({
        success: true
    });
});

async function sendPushNotifications(postTitle) {
    webpush.setVapidDetails('mailto:ivona.busljeta@fer.hr',
        'BGUaZ5_SwjyYPbkK-lSsIjUSTxZA_m7qxNaN2KlPPmtwEZHU8FvH_WRijzewlaMPlaF5ZUxQwMteLe3PQsqvDbQ',
        'HbiXG0DHP9rzx9etguuRxPyTGh6rmUcxiZ3_OpNFHxg');

    for (const sub of subscriptions) {
        try {
            console.log('Sending notification to', sub);
            await webpush.sendNotification(sub, JSON.stringify({
                title: 'New post!',
                body: 'Somebody just posted: ' + postTitle,
                redirectUrl: '/'
            }));
        } catch (error) {
            console.error(error);
        }
    }
}

const externalUrl = process.env.RENDER_EXTERNAL_URL;
const port = externalUrl && process.env.PORT ? parseInt(process.env.PORT) : 4080;

if (externalUrl) {
    const hostname = '0.0.0.0';
    app.listen(port, hostname, () => {
        console.log(`Server locally running at http://${hostname}:${port}/ and from outside on ${externalUrl}`);
    });
} else {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
}