var process = require('process');
var child_process = require('child_process');
var fs = require('fs');
var colors = require('colors');
var path = require('path');
var jsonFormat = require('json-format');
var readline = require('readline');
var cwd = process.cwd();

/**
 * 获取执行路径
 */
function getCwd() {
    return cwd;
}

/**
 * 执行命令
 * @param {(Array|String)} cmd 命令
 * @param {cwd(String)} params 其他参数 cwd
 */
function exec(cmd, params, success) {
    params = params || {};
    var run = function (scmd, callback) {
        child_process.exec(scmd, {
            cwd: params && params.cwd || cwd
        }, function (error, stdout, stderr) {
            if (error) {
                throw error
            }
            stdout && console.log(stdout.green);
            if(stderr){
                console.log(stderr.yellow)
            }
            callback && callback(stdout, stderr);
        });
    }
    if(cmd && typeof cmd == 'string'){
        cmd = cmd.split(',')
    }
    if(cmd && cmd.constructor.name === 'Array' && cmd.length){
        var scmd = cmd.shift();
        run(scmd, function(stdout, stderr){
            if(cmd.length){
                exec(cmd, params, success)
            }else{
                success && success(stdout, stderr);
            }
        })
    }else{
        console.log('cmd null'.yellow)
    }
}

/**
 * 获取环境变量
 */
function getArgs(){
    var argvs = [];
    for (var i = 2; i < process.argv.length; i++) {
        argvs.push(process.argv[i])
    }
    return argvs
}

/**
 * 安全获取json文件
 * @param {*} file_url 路径
 * @param {*} safe 是否安全获取
 */
function getJsonFile(file_url, safe) {
    var json;
    if(fs.existsSync(file_url)){
        if (safe) {
            var jsonStr = fs.readFileSync(file_url, 'utf-8');
            try {
                json = JSON.parse(jsonStr);
            } catch (err) {}
        } else {
            json = require(file_url);
        }
    }
    return json
}

/**
 * 安全设置json文件
 * @param {*} file_url 路径
 * @param {*} safe 是否安全获取
 */
function setJsonFile(file_url, object, safe) {
    if(typeof object !== 'object'){
        return
    }
    if(fs.existsSync(file_url) && safe){
        json = getJsonFile(file_url, true) || {};
        var setJson = function(oldJson, newJson){
            for(var key in newJson){
                if(typeof oldJson[key] === 'object' && typeof newJson[key] === 'object'){
                    setJson(oldJson[key], newJson[key])
                }else if(typeof oldJson[key] !== 'object' && typeof newJson[key] !== 'object'){
                    oldJson[key] = newJson[key];
                }
            }
        }
        setJson(json, object);
    }
    makeFile(file_url, jsonFormat(object))
    return object
}

/**
 * 拷贝文件
 * @param {*} src 源路径
 * @param {*} dst 目标路径
 * @param {[*]} ignores 忽略文件
 */
function copyFile(src, dst, ignores) {
    if(!fs.existsSync(src)){
        return
    }
    var stat = fs.statSync(src);
    if(stat.isDirectory()){
        !fs.existsSync(dst) && makeFile(dst.replace(/[\/|\\][^\/|\\]*$/,''));
        var paths = fs.readdirSync(src);
        if (paths.length) {
            paths.forEach(function (file) {
                if(!(ignores && ignores.include(file))){
                    var childSrc = path.join(src, file);
                    var childDst = path.join(dst, file);
                    copyFile(childSrc, childDst, ignores);
                }
            });
        }
    }else{
        var buffer = fs.readFileSync(src);
        if(path.extname(dst) && buffer){
            makeFile(dst, buffer);
        }else if(buffer){
            makeFile(path.join(dst, path.basename(src)), buffer);
        }
    }
}

/**
 * 移除文件
 * @param {*} dst 移除目录
 */
function removeFile(dst) {
    var paths = fs.readdirSync(dst);
    paths.forEach(function (file) {
        var _dst = path.join(dst, file); //拼接子文件路径
        var _stat = fs.statSync(_dst)
        if (_stat.isFile()) {
            fs.unlinkSync(_dst); //若为文件则删除
        } else if (_stat.isDirectory()) {
            removeFile(_dst)
        }
    })
    try {
        fs.rmdirSync(dst);
    } catch (err) {}
}

/**
 * 创建文件、文件夹
 * @param {*} filePath 路径
 * @param {*} txt 有文本及文件名带后缀则为文件，否则文件夹
 */
function makeFile(filePath, txt) {
    var files = [];
    while(!path.dirname(filePath).match(/^\w+\:\\?$|^\/$/)){
        files.unshift(filePath);
        filePath = path.dirname(filePath);
    }
    files.unshift(filePath);
    files.forEach(function(file, index){
        if(index < files.length - 1 && !fs.existsSync(file)){
            fs.mkdirSync(file);
        }else if(txt !== undefined && path.extname(file)){
            fs.writeFileSync(file, txt);
        }else if(!fs.existsSync(file)){
            fs.mkdirSync(file);
        }
    })
}

/**
 * 路径格式化小驼峰命名
 * @param {*} path 路径
 */
function formatFileNameByPath(path) {
    var name = path;
    if(path && typeof path == 'string'){
        name = path.replace(/[\/-](\w)/g, function(m, p) {
            return p.toUpperCase();
        });
    }
    return name;
}


/**
 * 流程输入
 * @param {config(Array)} params {key: '', //必填
        desc: '',
        defaultValue: '',
        value: '',
        regExp: //,
        msg: ''}
 * @param {*} callback 
 */
function input(params, callback) {
    params.index = params.index || 0;
    let config = params.config[params.index];
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(config.desc + '  ', function (value) {
        config.value = value || config.defaultValue || '';
        rl.close();
        if (params.index >= params.config.length - 1) {
            var json = {};
            for(var i = 0; i< params.config.length; i++){
                json[params.config[i].key] = params.config[i].value;
            }
            callback && callback(json);
        } else {
            if (config.regExp) {
                if (config.required) {
                    if (config.value.match(config.regExp)) {
                        params.index++;
                    } else {
                        console.log(config.msg);
                    }
                } else if(config.value && !config.value.match(config.regExp)){
                    console.log(config.msg);
                } else {
                    params.index++;
                }
            } else if (config.required){
                if (config.value) {
                    params.index++;
                } else {
                    console.log(config.msg);
                }
            }else {
                params.index++;
            }
            input(params, callback)
        }
    })
}

module.exports = {
    getCwd: getCwd,
    getArgs: getArgs,
    exec: exec,
    getJsonFile: getJsonFile,
    setJsonFile: setJsonFile,
    copyFile: copyFile,
    removeFile: removeFile,
    makeFile: makeFile,
    jsonFormat: jsonFormat,
    formatFileNameByPath: formatFileNameByPath,
    input: input,
    fs: fs
}