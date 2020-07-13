import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME, DEFAULT_PACKET_SIZE, DEFAULT_SUBSCRIBE_TIME } from './settings';
import * as PlatformAccessories from './accessories';

import { Arlo } from 'node-arlo';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ArloPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  public readonly arlo = new Arlo();

  protected readonly disabled: boolean = false;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    if (!config) {
      this.log.warn(`Ignoring ${PLATFORM_NAME} Platform setup because it is not configured.`);
      this.disabled = true;
      return;
    }

    if (!this.config.include_cameras) {
      this.config.include_cameras = true;
    }

    if (!this.config.stay_arm) {
      this.config.stay_arm = Arlo.ARMED;
    }

    if (!this.config.night_arm) {
      this.config.night_arm = Arlo.ARMED;
    }

    if (!this.config.interval) {
      this.config.interval = DEFAULT_SUBSCRIBE_TIME;
    }

    if (!this.config.videoProcessor) {
      this.config.videoProcessor = require('ffmpeg-for-homebridge') || 'ffmpeg';
    }

    if (!this.config.videoDecoder) {
      this.config.videoDecorder = '';
    }

    if (!this.config.videoEncoder) {
      this.config.videoEncoder = 'libx264';
    }

    if (!this.config.packetSize) {
      this.config.packetSize = DEFAULT_PACKET_SIZE;
    }

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

    this.arlo.on(Arlo.FOUND, (device) => {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.id);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.context.device = device;
        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `accessories`
        switch (device.getType()) {
          case Arlo.BASESTATION:
            this.log.info(`Online: Base Station ${existingAccessory.displayName} [${device.id}]`);
            new PlatformAccessories.BaseStation(this, existingAccessory);
            break;
          case Arlo.CAMERA:
            if (this.config.include_cameras) {
              this.log.info(`Online: Camera ${existingAccessory.displayName} [${device.id}]`);
              new PlatformAccessories.Camera(this, existingAccessory);
            }
            break;
          case Arlo.Q:
            if (this.config.include_cameras) {
              this.log.info(`Online: Camera ${existingAccessory.displayName} [${device.id}]`);
              new PlatformAccessories.Q(this, existingAccessory);
            }
            break;
        }

      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.getName());

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.getName(), uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `accessories`
        switch (device.getType()) {
          case Arlo.BASESTATION:
            this.log.info(`Found: Base Station ${device.getName()} [${device.id}]`);
            new PlatformAccessories.BaseStation(this, accessory);
            break;
          case Arlo.CAMERA:
            if (this.config.include_cameras) {
              this.log.info(`Found: Camera ${device.getName()} [${device.id}]`);
              new PlatformAccessories.Camera(this, accessory);
            }
            break;
          case Arlo.Q:
            if (this.config.include_cameras) {
              this.log.info(`Found: Camera ${device.getName()} [${device.id}]`);
              new PlatformAccessories.Q(this, accessory);
            }
            break;
        }

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
      // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    });

    this.arlo.login(this.config.email, this.config.password);

  }
}