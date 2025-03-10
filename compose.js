const yaml = require('js-yaml');
const fs = require('fs');
const stream = require('stream');

const secrets = require('./lib/secrets');
const volumes = require('./lib/volumes');
const configs = require('./lib/configs');
const networks = require('./lib/networks');
const services = require('./lib/services');
const tools = require('./lib/tools');

class Compose {
  constructor(dockerode, file, projectName) {
    this.docker = dockerode;

    if (file === undefined || projectName === undefined) {
      throw new Error('please specify a file and a project name');
    }

    this.file = file;
    this.projectName = projectName;

    try {
      this.recipe = yaml.load(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      throw e;
    }
  }

  async down(options) {
    let output = {};
    try { 
      output.file = this.file;
      output.services = await services.down(this.docker, this.projectName, this.recipe, output, options);
      output.networks = await networks.down(this.docker, this.projectName, this.recipe, output);
      if (options !== undefined) {
        if (options.volumes) {
          output.volumes = await volumes.down(this.docker, this.projectName, this.recipe, output);
        }
      }
      return output;
    } catch (e) {
      throw e;
    }
  }

  async up(options, upParams) {
    let output = {};
    try {
      output.file = this.file;
      let instanceIdString = options.instanceId!==undefined?'-'+options.instanceId:'';
      output.secrets = await secrets(this.docker, this.projectName+instanceIdString, this.recipe, output);
      output.volumes = await volumes.up(this.docker, this.projectName+instanceIdString, this.recipe, output);
      output.configs = await configs(this.docker, this.projectName+instanceIdString, this.recipe, output);
      output.networks = await networks.up(this.docker, this.projectName+instanceIdString, this.recipe, output);
      output.services = await services.up(this.docker, this.projectName+instanceIdString, this.recipe, output, options, upParams);
      return output;
    } catch (e) {
      throw e;
    }
  }

  async pull(serviceN, options) {
    options = options || {};
    let streams = [];
    let serviceNames = (serviceN === undefined || serviceN === null) ? tools.sortServices(this.recipe) : [serviceN];
    for (let serviceName of serviceNames) {
      let service = this.recipe.services[serviceName];
      try {
        let streami = await this.docker.pull(service.image, options);
        streams.push(streami);

        if (options.verbose === true) {
          streami.pipe(process.stdout);
        }

        if (options.streams !== true) {
          if (options.verbose === true) {
            streami.pipe(process.stdout);
          } else {
            streami.pipe(stream.PassThrough());
          }
          await new Promise(fulfill => streami.once('end', fulfill));
        }
      } catch (e) {
        throw e;
      }
    }
    return streams;
  }
}

module.exports = Compose;