const express = require('express');
const Joi = require('joi'); //used for validation
const app = express();
const {
    exec
} = require('child_process');
const {
    MongoClient
} = require('mongodb');
app.use(express.json());


const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    };
};

async function set_mongo(obj) {
    /**
     * Connection URI. Update <username>, <password>, and <your-cluster-url> to reflect your cluster.
     * Example mongodb://<server address>:<server port>/<database name>/<collection name>
     */
    const url_mongo = "mongodb://localhost:27017/identity/sites";
    const client = new MongoClient(url_mongo, {
        useUnifiedTopology: true
    });
    try {
        // Connect to the MongoDB cluster
        await client.connect();
        await client.db('identity').collection('sites').insertOne(obj);
        await client.close();
        return search_mongo(obj.urls);
    } catch (e) {
        await client.close();
        return e;
    }
}

async function search_mongo(url) {
    const url_mongo = "mongodb://localhost:27017/identity/sites";
    const client = new MongoClient(url_mongo, {
        useUnifiedTopology: true
    });
    try {
        // Connect to the MongoDB cluster
        await client.connect();
        const queries = {
            urls: url,
            "technologies.categories.slug": 'cms'
        };
        const site = await client.db("identity").collection("sites").findOne(queries);
        if (site == null) {
            const exist_site = await client.db("identity").collection("sites").findOne({
                urls: url
            });
            if (exist_site == null) {
                return url
            }
            return false;
        }
        const count = 0
        const result = 0;
        while (true) {
            if (site.technologies[count].categories[0].slug == 'cms') {
                const name = site.technologies[count].name;
                const version = site.technologies[count].version;
                global.result = { name, version };
                break;
            }
            count++;
        }

        // const rest = JSON.stringify(global.result, getCircularReplacer()); //برای نمایش خروجی کوئری در ترمینال
        global.result["status"] = true;
        await client.close();
        return global.result;

    } catch (e) {
        await client.close();
        return e;
    }

}

app.get('/identity_site', async (req, res) => {
    const result_search = await search_mongo(req.query.url)
    if (result_search == req.query.url) {
        exec(`node wappalyzer/src/drivers/npm/cli.js ${req.query.url}`, async (err, stdout, stderr) => {
            if (err) {
                console.error(err);
            } else {
                try {
                    // console.log(`stdout: ${stdout}`);
                    // console.log(`stderr: ${stderr}`);
                    const data = stdout;
                    const object = JSON.parse(data);
                    const urls = {
                        "urls": req.query.url
                    };
                    const technologies = {
                        "technologies": object.technologies
                    };
                    const obj = {
                        ...urls,
                        ...technologies
                    };
                    const result = await set_mongo(obj);
                    if (result) {
                        res.json(result);
                        return true;
                    } else {
                        res.json({ status: false });
                        return true;
                    }
                } catch (err) {
                    res.send(err);
                }
            }
        });
    } else if (result_search) {
        res.json(result_search);
        return true;
    } else {
        res.json({ status: false });
        return true;
    }
});


app.get('/remove/identity_site', async (req, res) => {
    const url_mongo = "mongodb://localhost:27017/identity/sites";
    const client = new MongoClient(url_mongo, {
        useUnifiedTopology: true
    });
    try {
        // Connect to the MongoDB cluster
        await client.connect();
        const queries = {
            urls: req.query.url
        };
        await client.db("identity").collection("sites").findOneAndDelete(queries);
        await client.close();
        res.json({ status: true });

    } catch (e) {
        await client.close();
        res.json({ status: false });
    }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Listening on port ${port}..`));

