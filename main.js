const express = require('express')
    , http = require('http')
    , HttpStatus = require('http-status-codes')
    , app = express()
    , config = require('config')
    , sleep = require("util").promisify(setTimeout)
    , ks0212 = require('./lib/ks0212.js')
    , dht = require('node-dht-sensor');


global.power = false;
global.poweron_date = null;
global.preset_temp = 0;
global.sensor = {};

app.disable('x-powered-by');


//init
ks0212.off(config.switch_gpio.power);
ks0212.off(config.switch_gpio.ext3h);
ks0212.off(config.switch_gpio.up);
ks0212.off(config.switch_gpio.down);


if (config.heater.auto_extend)
{
    setInterval(function()
        {if (global.power) ks0212.push(config.switch_gpio.ext3h);}
     , config.heater.auto_extend_interval * 60000);
}

setInterval(readSensor, config.sensor.read_interval);


//power control
app.put('/power/*',(req, res) =>
{
    var cmd = req.url.split('/')[2];

    var d = {};
    d.result = "ok";
    d.cmd = cmd;

    switch (cmd)
    {
        case "on" :
            if (global.power) break;

            ks0212.push(config.switch_gpio.power);
            global.power = !global.power;

            sleep(500);

            //init temp
            ks0212.push(config.switch_gpio.down, 4500);
            global.preset_temp = config.heater.temp_min;
            global.poweron_date = new Date;

            d.message = "power is on.";
            break;

        case "off" :
           if (!global.power) break;

           ks0212.push(config.switch_gpio.power);
           global.power = !global.power;
           d.message = "power is off.";
           break;
        default:
           d.result = "error";
           d.message = "invalid command: " + cmd;
           break;
    }

    res.set('Content-Type', 'text/javascript; charset=utf-8');
    res.send(getStatus(d)); 
});


//temperature control
app.put('/temp/*',(req, res)=>
{
    var cmd = req.url.split('/')[2];

    console.log("cmd : %s",cmd);

    var d = {};
    d.result = "ok";
    d.cmd = cmd;

    if (/^[0-9]{2}$/.test(cmd))
    {
        var x = Number(cmd);
        var i = (config.heater.count_interval) + (global.preset_temp <= config.heater.temp_min) ? (config.heater.initial_wait) : 0

        if (x >= config.heater.temp_min && x <= config.heater.temp_max)
        {
            var n = i + Math.abs(config.heater.count_interval * (x - global.preset_temp));

            ks0212.push((x > global.preset_temp) ? config.switch_gpio.up : config.switch_gpio.down, n);
            global.preset_temp = x;

            d.count_interval = n;
            d.preset_temp = global.preset_temp;
        }
    }
    else
    {
        var n = i + config.heater.count_interval;

        switch (cmd){
            case "up":
                if (global.preset_temp <= config.heater.temp_min)
                {
                    ks0212.push(config.switch_gpio.up, n);
                    global.preset_temp += 1;
                }
                else if (global.preset_temp < config.heater.temp_max)
                {
                    ks0212.push(config.switch_gpio.up, n);
                    global.preset_temp += 1;
                }
                break;
            case "down":
                if (global.preset_temp > config.heater.temp_min)
                {
                    ks0212.push(config.switch_gpio.down, n);
                    global.preset_temp -= 1;
                }
                break;
            default :
                break;
        }
    }

    d.message = "temperature set to :" + global.preset_temp;

    res.set('Content-Type', 'text/javascript; charset=utf-8');
    res.send(getStatus(d)); 
});


app.put('/3h',(req, res)=>
{
    ks0212.push(config.switch_gpio.ext3h);
    var d = {};
    d.result = "ok";
    d.cmd = "3h";
    d.message = "extend 3hrs.";

    res.set('Content-Type', 'text/javascript; charset=utf-8');
    res.send(getStatus(d)); 

});


app.get('/status',(req, res)=>
{
    var d = {};
    d.result = "ok";

    res.set('Content-Type', 'text/javascript; charset=utf-8');
    res.send(getStatus(d)); 
});


//debug
app.set('/set/temp/*',(req, res)=>
{
    var cmd = req.url.split('/')[3];
    console.log("cmd : %s",cmd);

    if (/^[0-9]{2}$/.test(cmd))
    {
        global.preset_temp = Number(cmd);
    }

    res.set('Content-Type', 'text/javascript; charset=utf-8');
    res.send(`{result: "ok", "message" : "preset_temp set to : ${global.preset_temp}}"`); 
});


//debug
app.set('/set/power/*',(req, res)=>
{
    var cmd = req.url.split('/')[3];
    console.log("cmd : %s",cmd);

    if (/^[0-1]{1}$/.test(cmd))
    {
        global.power = Boolean(cmd);
    }

    res.set('Content-Type', 'text/javascript; charset=utf-8');
    res.send(`{result: "ok", "message" : "power set to : ${global.power}}"`); 
});


http.createServer(app).listen(config.listen_port, function(){
  console.log('http server listening on port: ' + config.listen_port);
});


function getStatus(p)
{
    readSensor();

    var d = {};

    d.result = p.result;
    d.message = p.message;
    d.cmd = p.cmd;
    d.power = global.power;
    d.uptime = global.poweron_date;
    d.preset_temp = global.preset_temp;
    d.sensor = global.sensor;

    return JSON.stringify(d);
}


function readSensor()
{
    dht.read(config.sensor.type, config.sensor.gpio, (err, temp, humid) => {
        sensor.result = "error";

        if (err) {
            sensor.message = "Unable to retrieve data.";
        } else {
            sensor.result = "ok";
            sensor.message = "";
            sensor.date = new Date;
            sensor.temperature = temp;
            sensor.humidity = humid;
        }
    });
}
