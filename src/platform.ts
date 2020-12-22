import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SomneoAccessory } from './platformAccessory';
import { Client } from 'node-ssdp';
import axios from 'axios';
import https from 'https';
import xml2js from 'xml2js';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SomneoPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly registered_usns: string[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    const client = new Client({});
    const instance = axios.create({
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false,
      }),
    });
    
    client.on('response', (headers, code, rinfo) => {
      if (this.registered_usns.find(usn => usn === headers.USN)) {
        return;
      } else {
        this.registered_usns.push(headers.USN);
      }
      
      const uuid = this.api.hap.uuid.generate(headers.USN);
      
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        this.log.info('   UUID:', uuid);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new SomneoAccessory(this, existingAccessory);

      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', uuid);

        const endpoint = 'https://' + rinfo.address + '/upnp/description.xml';
        
        instance.get(endpoint)
          .then((response) => {
            // handle success
            xml2js.parseString(response.data, (err, result) => {
              this.log.info(result.root.device);
              
              // create a new accessory
              const accessory = new this.api.platformAccessory(result.root.device[0].friendlyName, uuid);
      
              // store a copy of the device object in the `accessory.context`
              // the `context` property can be used to store any data about the accessory you may need
              accessory.context.device = rinfo;
              accessory.context.upnpData = result.root.device[0];
      
              // create the accessory handler for the newly create accessory
              // this is imported from `platformAccessory.ts`
              new SomneoAccessory(this, accessory);
      
              // link the accessory to your platform
              this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            });
    
            
          })
          .catch((error) => {
            // handle error
            this.log.info(error);
          });


      }
    
    });

    client.search('urn:philips-com:device:DiProduct:1');
  }
}
