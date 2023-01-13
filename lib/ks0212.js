module.exports = (function(){
    const { requestGPIOAccess } = require("node-web-gpio");
    const sleep = require("util").promisify(setTimeout);

    const J2  = 4
        , J3  = 22
        , J4  = 6
        , J5  = 26;

    return {
        push :
            async function (port_no, wait = 150) {
                const gpio = await requestGPIOAccess();
                const port = gpio.ports.get(port_no);
                await port.export("out");

                await port.write(1);
                await sleep(wait);
                await port.write(0);
            },
        on :
            async function (port_no) {
                const gpio = await requestGPIOAccess();
                const port = gpio.ports.get(port_no);
                await port.export("out");
                await port.write(1);
            },
        off :
            async function (port_no) {
                const gpio = await requestGPIOAccess();
                const port = gpio.ports.get(port_no);

                await port.export("out");
                await port.write(0);
            }
    }
})();
