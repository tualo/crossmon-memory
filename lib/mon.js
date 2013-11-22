var ps = require('./ps');

function setup(config,callback){
	
	if (typeof config['scale']=='undefined'){
		config['scale'] = 1;
	}
	if (typeof config['all']=='undefined'){
		config['all'] = false;
	}
	if (typeof config['programs']=='undefined'){
		config['programs'] = [];
	}
	var readline = require('readline');
	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	rl.question("How many GB of memory you have installed? ["+Math.round(1/config.scale)+"] ", function(answer) {
		
		if (answer==''){
			answer = config.scale;
		}
		if (isNaN(answer)){
			callback({error:'no number'},config);
		}else{
			config.scale = Math.round( (1/answer)*10000 )/10000;
			var chrs = 'y,n';
			if(config['all']){ chrs = 'yes'; }else{ chrs = 'no'; }
			rl.question("Should the sum of all processes be monitored? [y,n] (currently "+chrs+") ", function(answer) {
				answer = answer.toLowerCase();
				if (answer=='y'){
					config['all'] = true;
				}
				if (answer=='n'){
					config['all'] = false;
				}
				_setup(config,rl,{cmd:'help'},callback);
			});
		}
	});
}
function _text(str,length,fill){
	if (!fill) fill = ' ';
	while(str.length<length){
		str+=fill;
	}
	return str;
}
function _setup(config,rl,opt,callback){
	console.log('');
	var help = [
		'Now you can setup the processes that you want to monitor.',
		'Following commands are allowed: ',
		"\thelp\tprint this help",
		"\tlist\tshow the current configured process list",
		"\tadd\tadd an entry",
		"\tremove\tremoving an entry",
		"\tsave\tsave the current settings and exit",
		"\texit\texit without saving"
	];
	var lines = [];
	switch (opt.cmd){
		case 'help':
			lines = help;
			break;
		case 'list':
			lines.push(' '+_text('',78,'-')+' ');
			lines.push('|'+_text(' Title',25)+'|'+_text(' Command contains',52)+'|');
			lines.push(' '+_text('',78,'-')+' ');
			for(var i in config.programs){
				if (typeof config.programs[i].indexOf!='undefined'){
					config.programs[i].contains = config.programs[i].indexOf;
					delete config.programs[i].indexOf;
				}
				lines.push('|'+_text(' '+config.programs[i].tag,25)+'|'+_text(' '+config.programs[i].contains,52)+'|');
			}
			lines.push(' '+_text('',78,'-')+' ');
			break;
	}
	console.log(lines.join("\n"));
	rl.question('> ',function(answer) {
		switch(answer){
			case 'exit':
				rl.close();
				callback({code:0},config);
				break;
			case 'save':
				rl.close();
				callback(null,config);
				break;
			case 'list':
				_setup(config,rl,{cmd:'list'},callback);
				break;
			case 'remove':
				rl.question('title to remove> ',function(answer) {
					var new_list = [];//config.programs;
					for(var i in config.programs){
						if (config.programs[i].tag!=answer){
							new_list.push(config.programs[i]);
						}
					}
					config.programs = new_list;
					_setup(config,rl,{cmd:'list'},callback);
				});
			case 'add':
				rl.question('title to add> ',function(title) {
					rl.question('command contains> ',function(contains) {
						config.programs.push({
							tag: title,
							contains: contains
						});
						_setup(config,rl,{cmd:'list'},callback);
					});
				});
				break;
			default:
				_setup(config,rl,{cmd:'help'},callback);
				break;
		}
	});
}

function test(config){
	if (typeof config['scale']=='undefined'){
		config['scale'] = 1;
	}
	collect(config,function(items){
		console.log( items);
	});
}

function monitor(socket,config){
	//console.log(arguments);
	if (typeof config['scale']=='undefined'){
		config['scale'] = 1;
	}
	
	collect(config,function(items){
		for(var i in items){
			var item = items[i];
			socket.emit('put', item);
		}
	});
	
}

function collect(config,callback){
	scale = config['scale'];
	ps()
	.args('aux')
	.exec(function (err,str,str_err){
		if (err){
		
		}else{
			var timestamp = new Date().getTime() ; // JS Timestamp
			var pslist = parsePS(str);
			if (config['all'] === true){
				var sum = 0; 
				for(var i in pslist){ sum+=pslist[i].memory }
				var item = { 
					program: 'memory',
					tag: 'all',
					time: timestamp,
					value: (sum/1024/1024/1024) * scale *100
				};
				callback([item]);
			}
			
			if (typeof config['programs'] !== 'undefined'){
				var programms =  config['programs'];
				var items=[];
				for(var p in programms){
					
					
					if (typeof programms[p].contains!=='undefined'){
						var contains =  programms[p].contains ;
						var sum = 0; 
						for(var i in pslist){
							if (pslist[i].command.indexOf(contains)>=0){
								sum+=pslist[i].memory;
							}
						}
						var item = { 
							program: 'memory',
							tag: 'memory-'+programms[p].tag,
							time: timestamp,
							value: (sum/1024/1024/1024)*scale *100
						};
						items.push(item);
						
					}
				}
				callback(items);
			}
			
		}
	})
}

function parsePS(output) {
  var lines = output.trim().split('\n');
   
  var labelsMap = {};
  var labels = lines[0].trim().split(/[ \t]+/g);
	for (var i = 0; i < labels.length; i++){
    labelsMap[labels[i]] = i;
	}

	var list = [];
	 
	for(var i=1; i<lines.length;i++){
		var values = lines[i].trim().split(/[ \t]+/g);
	
		var foundPID = parseInt(values[labelsMap['PID']], 10);
		var rss = 1024 * parseInt(values[labelsMap['RSS']], 10);
		var cpu = parseFloat( values[labelsMap['%CPU']].replace(/,/g,".") );
		var command = values[labelsMap['COMMAND']];
		var vi = labelsMap['COMMAND']+1;
		while(vi<values.length){
			command+=' '+values[vi];
			vi++;
		}
	
		list.push({ command: command,memory: rss, cpu: cpu });
	}
	return list;
}

module.exports.setup=setup;
module.exports.test=test;
module.exports.monitor=monitor;