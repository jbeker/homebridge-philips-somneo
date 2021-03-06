import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { SomneoPlatform } from './platform';

import axios from 'axios';
import https from 'https';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SomneoAccessory {
  private lightService: Service;
  private tempService: Service;
  private humidityService: Service;
  private lightLevelService: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private somneoState = {
    On: false,
    Brightness: 100,
    Temperature: 0,
    Humidity: 0,
    LightLevel: 0,
    Sound: 0,
  }

  constructor(
    private readonly platform: SomneoPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    
    // Get basic data from Somneo
    this.platform.log.info('Somneo IP ->', accessory.context.device.address);
    
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.upnpData.manufacturer)
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.upnpData.modelName)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.upnpData.UDN);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.lightService = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.lightService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.upnpData.friendlyName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.lightService.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .on('get', this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.lightService.getCharacteristic(this.platform.Characteristic.Brightness)
      .on('set', this.setBrightness.bind(this));       // SET - bind to the 'setBrightness` method below
      
      
    //=====================================================================================================
    this.tempService = this.accessory.getService(this.platform.Service.TemperatureSensor) || this.accessory.addService(this.platform.Service.TemperatureSensor);
      
    // register handlers Temperature Characteristic
    this.tempService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .on('get', this.getTemperature.bind(this));
      
    //=====================================================================================================
    this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor) || this.accessory.addService(this.platform.Service.HumiditySensor);
      
    // register handlers Humidity Characteristic
    this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .on('get', this.getHumidity.bind(this));
      
    //=====================================================================================================
    this.lightLevelService = this.accessory.getService(this.platform.Service.LightSensor) || this.accessory.addService(this.platform.Service.LightSensor);
      
    // register handlers Humidity Characteristic
    this.lightLevelService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
      .on('get', this.getLightLevel.bind(this));

    this.updateSensorData();
    
    // Update periodically
    setInterval(() => {
      this.updateSensorData();
    }, 60 * 1000); // 5 minutes
  }
  
  updateSensorData() {
    const instance = axios.create({
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false,
      }),
    });
    
    const endpoint = 'https://' + this.accessory.context.device.address + '/di/v1/products/1/wusrd';
    
    instance.get(endpoint)
      .then((response) => {
        this.platform.log.info('Updating Sensors');
        // handle success
        this.somneoState.Temperature = response.data.mstmp;
        this.somneoState.Humidity = response.data.msrhu;
        this.somneoState.LightLevel = response.data.mslux;
        this.somneoState.Sound = response.data.mssnd;
        
        this.tempService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).updateValue(this.somneoState.Temperature);
        this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity).updateValue(this.somneoState.Humidity);
        this.lightLevelService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel).updateValue(this.somneoState.LightLevel);
      })
      .catch((error) => {
        // handle error
        this.platform.log.info(error);
      });
      
  }

  
  getTemperature(callback: CharacteristicGetCallback) {
    const currentTemperature = this.somneoState.Temperature;
    this.platform.log.info('Get Temperature ->', currentTemperature);
    callback(null, currentTemperature);
  }
  
  getHumidity(callback: CharacteristicGetCallback) {
    const currentHumidity = this.somneoState.Humidity;
    this.platform.log.info('Get Humidity ->', currentHumidity);
    callback(null, currentHumidity);
  }
  
  getLightLevel(callback: CharacteristicGetCallback) {
    const currentLightLevel = this.somneoState.LightLevel;
    this.platform.log.info('Get Light Level ->', currentLightLevel);
    callback(null, currentLightLevel);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to turn your device on/off
    this.somneoState.On = value as boolean;

    this.platform.log.info('Set Characteristic On ->', value);

    // you must call the callback function
    callback(null);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.lightService.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getOn(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const isOn = this.somneoState.On;

    this.platform.log.info('Get Characteristic On ->', isOn);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to set the brightness
    this.somneoState.Brightness = value as number;

    this.platform.log.info('Set Characteristic Brightness -> ', value);

    // you must call the callback function
    callback(null);
  }

}
