const cluster = require('cluster');
const process = require("process");
const {cpus} = require("os")
const net = require("net");

const proxyConfig ={
    host: "127.0.0.1",
    port:8080
} 

const numCPUs = cpus().length;

if(cluster.isPrimary){
    console.log(`Process id ${process.id} is running in primary`);
    for(let i=0; i<numCPUs;i++){
        cluster.fork();
    }
    cluster.on("disconnect",()=>{
        console.log("a node is disconnected ... starting a new node");
        cluster.fork();
        console.log("new node started");
    })
}else{
    const server = net.createServer();
    
    server.on("connection",(clientToProxySocket)=>{
        clientToProxySocket.once("data",(data)=>{
            let isTLSConnection = data.toString().indexOf("CONNECT") !== -1;
    
            let serverPort = 80;
            let serverAddress;
    
            if(isTLSConnection){
                serverPort = 443;
                serverAddress = data.toString().split("CONNECT")[1].split(" ")[1].split(":")[0];
            }else{
                serverAddress = data.toString().split("Host: ").split("\n")[0];
            }
            let proxyToServerSocket = net.createConnection({
                host:serverAddress,
                port:serverPort
            },()=>{
                console.log("Proxy to site connection estsablished");
            });
    
            if(isTLSConnection){
                clientToProxySocket.write("HTTP/1.1 200 OK\r\n\n")
            }else{
                proxyToServerSocket.write(data);
            }
            clientToProxySocket.pipe(proxyToServerSocket);
            proxyToServerSocket.pipe(clientToProxySocket);
            clientToProxySocket.on('error',(err)=>{
                console.log(`P2S-ERROR:${err}`);
            })
            proxyToServerSocket.on("error",(err)=>{
                console.log(`C2P-EROOR:${err}`);
            })
        });
    })
    server.on("error",(err)=>{
        console.log(`Error:${err}`);
    });
    server.on("close",()=>{
        console.log("client disconnected");
    })
    
    server.listen(proxyConfig,()=>{
        console.log(`Server is listening on ${proxyConfig.host}:${proxyConfig.port}`);
    });
}