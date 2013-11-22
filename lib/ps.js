var exec = require('child_process').exec;

var create = function() {
	return new ps();
};

var ps = function() {
	this.options = [];
	this.command = 'ps';
};
ps.prototype.args = function(opt) {
	this.options.push(opt);
	return this;
}
ps.prototype.exec = function(callback) {
	var self = this;
	var args = this.options.join(' ');
	var child = exec(this.command + ' '+ args  + ' ', function(err, stdout, stderr) {
		child.kill('SIGHUP');
		callback(err, stdout, stderr);
	});
};

module.exports = create;