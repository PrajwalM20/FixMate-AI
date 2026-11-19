import type { ApplianceCategory, KnowledgeBaseEntry } from '../types/domain.ts';

export const SAMPLE_APPLIANCE_CATEGORIES: ApplianceCategory[] = [
  {
    id: 'cat_refrigerator',
    slug: 'refrigerator',
    name: 'Refrigerator',
    description:
      'Single-door, double-door, inverter compressor, and frost-free cooling units.',
    commonFaultsCount: 14,
    isActive: true,
    safetyNotice: 'Disconnect mains power before inspecting condenser coils or rear relay panels.',
  },
  {
    id: 'cat_washing_machine',
    slug: 'washing_machine',
    name: 'Washing Machine',
    description:
      'Front-load, top-load, and semi-automatic washers with drain pumps and drum motors.',
    commonFaultsCount: 12,
    isActive: true,
    safetyNotice: 'Shut off water inlet valves and unplug power before clearing drain traps.',
  },
  {
    id: 'cat_air_conditioner',
    slug: 'air_conditioner',
    name: 'Air Conditioner',
    description:
      'Split inverter, window AC, and smart HVAC cooling units with outdoor condensers.',
    commonFaultsCount: 11,
    isActive: true,
    safetyNotice: 'Do not open sealed refrigerant lines or high-voltage outdoor capacitor housings.',
  },
  {
    id: 'cat_laptop',
    slug: 'laptop',
    name: 'Laptop',
    description:
      'Consumer and workstation notebooks, thermal cooling assemblies, batteries, and displays.',
    commonFaultsCount: 15,
    isActive: true,
    safetyNotice: 'Power down and disconnect AC adapter before clearing vents or external ports.',
  },
  {
    id: 'cat_television',
    slug: 'television',
    name: 'Television',
    description:
      'LED, QLED, OLED smart televisions, backlight drivers, and HDMI/T-Con boards.',
    commonFaultsCount: 9,
    isActive: true,
    safetyNotice: 'Never open the rear casing; high-voltage power supply capacitors retain charge.',
  },
  {
    id: 'cat_microwave',
    slug: 'microwave',
    name: 'Microwave',
    description:
      'Solo, grill, and convection microwave ovens with turntable motors and waveguide covers.',
    commonFaultsCount: 8,
    isActive: true,
    safetyNotice: 'CRITICAL: Never disassemble microwave housings due to lethal high-voltage capacitors.',
  },
  {
    id: 'cat_other',
    slug: 'other',
    name: 'Other Household Appliances',
    description:
      'Dishwashers, water purifiers, induction cooktops, vacuum cleaners, and small electronics.',
    commonFaultsCount: 10,
    isActive: true,
    safetyNotice: 'Inspect visible cords, breakers, and user-serviceable filters only after unplugging.',
  },
];

export const SAMPLE_KNOWLEDGE_BASE: KnowledgeBaseEntry[] = [
  {
    id: 'kb_fridge_not_cooling',
    applianceCategory: 'refrigerator',
    faultTitle: 'Fresh Food Compartment Warm While Freezer Remains Cold',
    observableSymptoms: [
      'refrigerator compartment warm',
      'freezer working normally',
      'frost buildup on back wall',
      'weak airflow from vents',
      'fan noise silent when door closed',
    ],
    possibleCauses: [
      'Blocked evaporator air damper or return vent',
      'Evaporator coil frost accumulation from defrost heater/thermostat failure',
      'Failed evaporator fan motor',
    ],
    followUpQuestions: [
      'Do you see thick frost or ice along the rear interior freezer panel?',
      'Can you hear the interior fan running when the freezer door switch is pressed?',
      'Has the door gasket been sealing tightly without warm air gaps?',
    ],
    safeTroubleshootingSteps: [
      'Check that food containers are not blocking air circulation vents between freezer and fridge.',
      'Inspect the magnetic door gasket around both doors for tears or debris preventing a seal.',
      'Verify thermostat dial or digital setpoint is at normal range (3C / 37F fridge, -18C / 0F freezer).',
      'If heavy frost covers the rear panel, perform a controlled 12-hour manual defrost with power unplugged and towels placed underneath.',
    ],
    riskLevel: 'medium',
    requiresProfessional: false,
    isSampleData: true,
  },
  {
    id: 'kb_fridge_clicking_compressor',
    applianceCategory: 'refrigerator',
    faultTitle: 'Repeated Clicking Sound and Compressor Failing to Start',
    observableSymptoms: [
      'clicking sound every few minutes',
      'fridge and freezer both warm',
      'compressor hot to touch',
      'lights on but not cooling',
    ],
    possibleCauses: [
      'Faulty PTC start relay or overload protector',
      'Dust-choked condenser coils causing thermal overload',
      'Seized compressor motor windings',
    ],
    followUpQuestions: [
      'How frequently does the clicking noise repeat (every 2–5 minutes)?',
      'Are the condenser coils beneath or behind the unit coated in dust?',
    ],
    safeTroubleshootingSteps: [
      'Unplug the refrigerator immediately to prevent overheating the start relay.',
      'Gently vacuum accessible rear or bottom condenser coils using a dry brush attachment.',
      'Wait 30 minutes and plug directly into a wall outlet (bypassing extension cords/power strips).',
      'If clicking resumes, schedule a certified technician to test the start relay and compressor impedance.',
    ],
    riskLevel: 'high',
    requiresProfessional: true,
    isSampleData: true,
  },
  {
    id: 'kb_washer_not_draining',
    applianceCategory: 'washing_machine',
    faultTitle: 'Washing Machine Fails to Drain Water After Cycle',
    observableSymptoms: [
      'standing water in drum',
      'drain error code',
      'spinning skipped',
      'humming sound during drain phase',
    ],
    possibleCauses: [
      'Clogged coin trap / drain pump filter',
      'Kinked or obstructed external drain hose',
      'Jammed impeller or burned-out drain pump motor',
    ],
    followUpQuestions: [
      'Does the control panel display a drain error code (such as OE, E21, or F05)?',
      'Have you cleaned the lower front coin trap filter within the last 3 months?',
    ],
    safeTroubleshootingSteps: [
      'Unplug the washer and place shallow towels and a tray beneath the front access panel.',
      'Slowly open the emergency drain tube and unscrew the pump filter cap to clear lint, coins, or buttons.',
      'Inspect the rear drain hose for sharp bends or kinks.',
      'Run a short Spin & Drain cycle; if humming continues with zero water flow, book a technician for pump replacement.',
    ],
    riskLevel: 'low',
    requiresProfessional: false,
    isSampleData: true,
  },
  {
    id: 'kb_washer_excessive_vibration',
    applianceCategory: 'washing_machine',
    faultTitle: 'Severe Vibration and Knocking During High-Speed Spin',
    observableSymptoms: [
      'loud banging during spin',
      'machine walking across floor',
      'unbalanced load error',
      'drum shaking violently',
    ],
    possibleCauses: [
      'Unbalanced laundry load or single heavy item',
      'Unleveled adjustable leveling feet',
      'Worn shock absorbers or suspension springs',
    ],
    followUpQuestions: [
      'Does the knocking occur even when spinning a light, evenly distributed load?',
      'Can you rock the washer diagonally by hand when stationary?',
    ],
    safeTroubleshootingSteps: [
      'Pause the cycle, open the door once unlocked, and redistribute heavy towels or bedding evenly.',
      'Check all four corner feet with a spirit level and tighten locknuts against the cabinet.',
      'Verify shipping transit bolts have been removed on newly installed front-load units.',
    ],
    riskLevel: 'medium',
    requiresProfessional: false,
    isSampleData: true,
  },
  {
    id: 'kb_ac_not_cooling',
    applianceCategory: 'air_conditioner',
    faultTitle: 'Air Conditioner Blowing Ambient Air Without Cooling',
    observableSymptoms: [
      'blowing warm or room temperature air',
      'outdoor fan not spinning',
      'ice on indoor evaporator pipe',
      'weak airflow from indoor unit',
    ],
    possibleCauses: [
      'Severely clogged indoor return air filters',
      'Tripped outdoor condenser breaker or failed run capacitor',
      'Low refrigerant charge from line leak',
    ],
    followUpQuestions: [
      'Is the outdoor condenser unit running when the indoor blower is active?',
      'Do you observe frost on the copper suction valve or indoor coils?',
    ],
    safeTroubleshootingSteps: [
      'Confirm the thermostat/remote is set to Cool mode at least 4C below room temperature.',
      'Power off the unit and wash the removable indoor mesh dust filters with mild water; let dry fully.',
      'Check that the outdoor unit has at least 60cm of unobstructed airflow around its intake and exhaust.',
      'If outdoor compressor remains silent or refrigerant ice persists, schedule an HVAC technician.',
    ],
    riskLevel: 'high',
    requiresProfessional: true,
    isSampleData: true,
  },
  {
    id: 'kb_ac_water_leaking',
    applianceCategory: 'air_conditioner',
    faultTitle: 'Indoor Air Conditioner Leaking Water Down Wall',
    observableSymptoms: [
      'water dripping from indoor vents',
      'wet wall below split unit',
      'gurgling sound in indoor unit',
    ],
    possibleCauses: [
      'Blocked condensate drain pipe due to algae or dust sludge',
      'Improperly sloped drain pan',
      'Frozen evaporator coil thawing rapidly',
    ],
    followUpQuestions: [
      'Is water dripping outside from the external condensate drain hose while running?',
      'Has the unit been serviced or coil-cleaned this season?',
    ],
    safeTroubleshootingSteps: [
      'Turn off the AC at the breaker to protect adjacent wall outlets from moisture.',
      'Check the exterior end of the condensate drain pipe for visible blockages or upward bends.',
      'Clean the indoor mesh filters to restore proper evaporator airflow.',
      'If internal drain pan clearing is required, arrange technician coil and drain flushing.',
    ],
    riskLevel: 'medium',
    requiresProfessional: true,
    isSampleData: true,
  },
  {
    id: 'kb_laptop_overheating_shutdown',
    applianceCategory: 'laptop',
    faultTitle: 'Thermal Throttling, Loud Fan Noise, and Sudden Shutdown',
    observableSymptoms: [
      'laptop overheating',
      'fan running at maximum speed',
      'sudden power off under load',
      'hot keyboard or bottom chassis',
    ],
    possibleCauses: [
      'Dust-clogged heatsink fins and cooling fan blades',
      'Dried thermal paste on CPU/GPU die',
      'Blocked intake vents on soft surfaces',
    ],
    followUpQuestions: [
      'Does the shutdown happen primarily during video calls, gaming, or heavy compilation?',
      'Do you feel warm air exiting the exhaust vents when the fan is loud?',
    ],
    safeTroubleshootingSteps: [
      'Move the laptop onto a hard, flat desk surface so bottom intake vents remain unobstructed.',
      'Power down completely, unplug charger, and use short bursts of compressed air into the exhaust vents (without overspinning fans).',
      'Check background processes in Task Manager / Activity Monitor for runaway CPU usage.',
      'If temperatures remain high or fan stays silent, book technician thermal repasting and fan inspection.',
    ],
    riskLevel: 'low',
    requiresProfessional: false,
    isSampleData: true,
  },
  {
    id: 'kb_laptop_no_boot_power',
    applianceCategory: 'laptop',
    faultTitle: 'Laptop Not Powering On or Blinking Charging LED',
    observableSymptoms: [
      'no display on power press',
      'charging light blinking',
      'no fan spin',
      'black screen with keyboard backlight',
    ],
    possibleCauses: [
      'Failed AC charger or loose DC jack',
      'Static charge lockup on embedded controller',
      'Faulty battery pack or motherboard power rail short',
    ],
    followUpQuestions: [
      'Does any charging indicator LED illuminate when the adapter is plugged in?',
      'Was there a recent liquid spill or power surge before the failure?',
    ],
    safeTroubleshootingSteps: [
      'Inspect the charger cable and USB-C/DC barrel connector for bent pins or fraying.',
      'Test with a known-good compatible power adapter on a verified wall outlet.',
      'Perform a hard EC reset by holding the power button for 20 seconds with charger unplugged.',
      'If zero response persists or liquid damage occurred, do not charge further—consult a repair technician.',
    ],
    riskLevel: 'medium',
    requiresProfessional: true,
    isSampleData: true,
  },
  {
    id: 'kb_tv_sound_no_picture',
    applianceCategory: 'television',
    faultTitle: 'Audio Plays Normally With Black or Very Dim Screen',
    observableSymptoms: [
      'sound works no picture',
      'black screen on tv',
      'faint image visible with flashlight',
      'power LED blinks',
    ],
    possibleCauses: [
      'Failed LED backlight strips',
      'Faulty backlight inverter / LED driver board',
      'T-Con board ribbon or power supply rail fault',
    ],
    followUpQuestions: [
      'If you shine a phone flashlight close to the screen while audio plays, can you faintly see menus?',
      'Does the standby power LED flash in a repeating blink pattern?',
    ],
    safeTroubleshootingSteps: [
      'Unplug the television from the wall outlet for 60 seconds, then press and hold the physical TV power button for 15 seconds.',
      'Reconnect directly to the wall and verify the active input source.',
      'Perform the non-invasive flashlight test on the screen surface.',
      'Never open the rear TV panel; backlight strip and driver board replacement requires a qualified technician.',
    ],
    riskLevel: 'high',
    requiresProfessional: true,
    isSampleData: true,
  },
  {
    id: 'kb_microwave_not_heating',
    applianceCategory: 'microwave',
    faultTitle: 'Microwave Turntable Spins and Light Works Without Heating',
    observableSymptoms: [
      'microwave runs but food stays cold',
      'turntable spinning normally',
      'loud buzzing sound when heating',
      'no heat',
    ],
    possibleCauses: [
      'Failed magnetron tube',
      'Faulty high-voltage diode or transformer',
      'Misaligned door interlock microswitch',
    ],
    followUpQuestions: [
      'Did you hear an unusually loud humming or snapping sound when heating stopped?',
      'Do you see any scorch marks on the interior mica waveguide cover?',
    ],
    safeTroubleshootingSteps: [
      'Verify the oven is not accidentally in Demo / Timer-Only mode and power level is set to 100%.',
      'Check that the door closes flush and latches cleanly without warped hinges.',
      'STOP HERE: Do not attempt to open the microwave outer cabinet. High-voltage capacitors store lethal charge even when unplugged. Book a certified technician.',
    ],
    riskLevel: 'critical',
    requiresProfessional: true,
    isSampleData: true,
  },
  {
    id: 'kb_microwave_sparking',
    applianceCategory: 'microwave',
    faultTitle: 'Arcing or Sparks Inside Microwave Cavity',
    observableSymptoms: [
      'sparks inside microwave',
      'arcing near right wall',
      'burning smell',
      'charred cover plate',
    ],
    possibleCauses: [
      'Grease-soaked or burnt mica waveguide cover',
      'Chipped interior cavity enamel exposing bare metal',
      'Metallic utensil or foil inside cavity',
    ],
    followUpQuestions: [
      'Do the sparks originate near the small rectangular cover plate on the interior side wall?',
    ],
    safeTroubleshootingSteps: [
      'Press Cancel immediately and unplug the microwave from the wall outlet.',
      'Once cool, inspect the interior cavity for metallic foil, food splatter, or a scorched waveguide cover.',
      'Do not operate the microwave again until a technician replaces any damaged waveguide cover or inspects the magnetron antenna.',
    ],
    riskLevel: 'critical',
    requiresProfessional: true,
    isSampleData: true,
  },
  {
    id: 'kb_other_power_trip',
    applianceCategory: 'other',
    faultTitle: 'Appliance Trips Circuit Breaker or GFCI Immediately on Plug-In',
    observableSymptoms: [
      'trips breaker',
      'gfci outlet pops',
      'burning smell from cord',
      'shocks when touching metal chassis',
    ],
    possibleCauses: [
      'Ground fault or internal insulation breakdown',
      'Moisture ingress in heating element or motor windings',
      'Damaged mains power cord',
    ],
    followUpQuestions: [
      'Does the breaker trip immediately upon plugging in or only when heating/motor activates?',
    ],
    safeTroubleshootingSteps: [
      'Unplug the appliance immediately and do NOT repeatedly reset the tripped breaker.',
      'Visually inspect the external power cord and plug prongs for heat discoloration or cuts.',
      'Keep the appliance disconnected and request a certified electrical appliance technician.',
    ],
    riskLevel: 'critical',
    requiresProfessional: true,
    isSampleData: true,
  },
];

export interface SampleDiagnosticPreset {
  kbId: string;
  label: string;
  applianceCategory: KnowledgeBaseEntry['applianceCategory'];
  applianceBrand: string;
  applianceModel: string;
  symptomSummary: string;
  symptomDetails: string;
  durationAnswer: string;
  envAnswer: string;
}

export const SAMPLE_DIAGNOSTIC_PRESETS: SampleDiagnosticPreset[] = [
  {
    kbId: 'kb_fridge_not_cooling',
    label: 'Fridge Warm / Freezer Cold',
    applianceCategory: 'refrigerator',
    applianceBrand: 'LG',
    applianceModel: 'GL-T372JDS3',
    symptomSummary: 'Refrigerator compartment is warm while freezer stays frozen',
    symptomDetails:
      'Lower fresh food section feels warm around 14C with very weak airflow from upper vents. Freezer holds ice normally, and thick frost is visible on the back freezer panel.',
    durationAnswer: 'Started gradually 2 days ago and runs continuously',
    envAnswer: 'No burning smell; interior fan goes silent when freezer door switch is pressed',
  },
  {
    kbId: 'kb_fridge_clicking_compressor',
    label: 'Fridge Clicking & Not Cooling',
    applianceCategory: 'refrigerator',
    applianceBrand: 'Whirlpool',
    applianceModel: 'IF INV 278',
    symptomSummary: 'Repeated clicking sound every 3 minutes and compressor fails to start',
    symptomDetails:
      'Interior lights turn on, but both fridge and freezer are warm. A sharp click repeats near the lower rear panel every few minutes and the compressor shell feels hot.',
    durationAnswer: 'Began this morning after a brief voltage fluctuation',
    envAnswer: 'Dust visible on rear coils; clicking stops for 3 minutes then repeats',
  },
  {
    kbId: 'kb_washer_not_draining',
    label: 'Washer Not Draining (OE)',
    applianceCategory: 'washing_machine',
    applianceBrand: 'Bosch',
    applianceModel: 'WAJ2426WIN',
    symptomSummary: 'Washing machine does not drain standing water after rinse cycle',
    symptomDetails:
      'Drum stays full of soapy water, high-speed spin is skipped, and a low humming noise plays during the drain phase. Panel shows drain error code.',
    durationAnswer: 'Happened on the last two consecutive wash loads',
    envAnswer: 'Control display blinks drain error code; no leaks on the floor',
  },
  {
    kbId: 'kb_washer_excessive_vibration',
    label: 'Washer Violent Spin Knocking',
    applianceCategory: 'washing_machine',
    applianceBrand: 'Samsung',
    applianceModel: 'WW70T502NAN',
    symptomSummary: 'Severe banging noise and machine walking across floor during spin',
    symptomDetails:
      'During high-speed spin, the drum shakes violently and bangs against the cabinet side panels even after pausing.',
    durationAnswer: 'Noticed over the past week with medium mixed loads',
    envAnswer: 'Shows UE unbalanced load code briefly; cabinet rocks diagonally when pushed',
  },
  {
    kbId: 'kb_ac_not_cooling',
    label: 'AC Blowing Warm Air',
    applianceCategory: 'air_conditioner',
    applianceBrand: 'Daikin',
    applianceModel: 'FTKM50U',
    symptomSummary: 'Split air conditioner blowing room temperature air without cooling',
    symptomDetails:
      'Indoor blower runs with weak airflow even on 18C Cool mode. The outdoor condenser fan is not spinning and thin ice appears on the indoor evaporator pipe.',
    durationAnswer: 'Started yesterday afternoon during peak heat',
    envAnswer: 'No error beep; indoor mesh filter has heavy dust buildup',
  },
  {
    kbId: 'kb_ac_water_leaking',
    label: 'AC Leaking Water Indoors',
    applianceCategory: 'air_conditioner',
    applianceBrand: 'Voltas',
    applianceModel: '183V Vectra',
    symptomSummary: 'Indoor split AC unit dripping water down the wall',
    symptomDetails:
      'Clear water drips continuously from the lower louver lip with occasional gurgling noise inside the evaporator tray.',
    durationAnswer: 'Started 3 hours after turning AC on tonight',
    envAnswer: 'External drain pipe outdoors appears completely dry',
  },
  {
    kbId: 'kb_laptop_overheating_shutdown',
    label: 'Laptop Thermal Shutdown',
    applianceCategory: 'laptop',
    applianceBrand: 'Dell',
    applianceModel: 'Inspiron 5510',
    symptomSummary: 'Laptop overheating with loud fan noise and sudden shutdown',
    symptomDetails:
      'Keyboard deck gets very hot, cooling fan stays at maximum RPM, and system powers off abruptly during video calls or compilation.',
    durationAnswer: 'Worsened over the last 3 weeks under moderate load',
    envAnswer: 'Warm air barely exits exhaust grill; no battery swelling observed',
  },
  {
    kbId: 'kb_laptop_no_boot_power',
    label: 'Laptop No Boot / Blinking LED',
    applianceCategory: 'laptop',
    applianceBrand: 'HP',
    applianceModel: 'Pavilion Aero 13',
    symptomSummary: 'Laptop does not power on and charging light blinks amber',
    symptomDetails:
      'Pressing the power button yields no fan spin and black screen while the side charging LED blinks repeatedly.',
    durationAnswer: 'Occurred suddenly this morning when unplugging from desk',
    envAnswer: 'No liquid spill; USB-C charger feels slightly loose in port',
  },
  {
    kbId: 'kb_tv_sound_no_picture',
    label: 'TV Audio Works, Black Screen',
    applianceCategory: 'television',
    applianceBrand: 'Sony',
    applianceModel: 'Bravia KD-55X80K',
    symptomSummary: 'Television plays sound clearly but screen stays completely black',
    symptomDetails:
      'Audio responds to volume remote buttons normally and standby LED blinks occasionally, while panel stays dark unless illuminated up close with a flashlight.',
    durationAnswer: 'Happened suddenly mid-program last evening',
    envAnswer: 'Faint menu outline visible under phone flashlight; red LED blinks 6 times',
  },
  {
    kbId: 'kb_microwave_not_heating',
    label: 'Microwave Spins Without Heat',
    applianceCategory: 'microwave',
    applianceBrand: 'IFB',
    applianceModel: '30SC4',
    symptomSummary: 'Microwave turntable spins and light turns on but food remains cold',
    symptomDetails:
      'Timer counts down normally and fan runs, with a louder-than-usual low buzz during heating, yet water stays completely cold after 2 minutes.',
    durationAnswer: 'Stopped heating suddenly today',
    envAnswer: 'Door latches cleanly; interior mica plate looks intact',
  },
  {
    kbId: 'kb_microwave_sparking',
    label: 'Microwave Cavity Sparking',
    applianceCategory: 'microwave',
    applianceBrand: 'Panasonic',
    applianceModel: 'NN-ST34HM',
    symptomSummary: 'Sparks and crackling arcing near right interior wall with burning smell',
    symptomDetails:
      'Visible flashes of arcing near the rectangular waveguide cover plate on the right cavity wall and acrid scorch odor after 5 seconds.',
    durationAnswer: 'Occurred once just now; immediately stopped and unplugged',
    envAnswer: 'Charred brown spot visible on right interior cover plate',
  },
  {
    kbId: 'kb_other_power_trip',
    label: 'Appliance Trips Breaker / GFCI',
    applianceCategory: 'other',
    applianceBrand: 'Philips',
    applianceModel: 'HD4928 Induction',
    symptomSummary: 'Appliance trips circuit breaker immediately when plugged into socket',
    symptomDetails:
      'As soon as the power cord is connected and wall switch turned on, the GFCI breaker pops with a faint burning smell near the rear cord entry.',
    durationAnswer: 'Started today after accidental kitchen counter splash',
    envAnswer: 'Breaker trips immediately; cord jacket looks slightly discolored near strain relief',
  },
];

export interface SampleTechnicianSeed {
  uid: string;
  displayName: string;
  bio: string;
  serviceCategories: KnowledgeBaseEntry['applianceCategory'][];
  skills: string[];
  experienceYears: number;
  serviceArea: string;
  availabilityStatus: 'available' | 'busy' | 'offline';
  verificationStatus: 'verified';
  ratingAvg: number;
  completedJobs: number;
}

export const VERIFIED_TECHNICIANS_DIRECTORY: SampleTechnicianSeed[] = [
  {
    uid: 'tech_arjun_nair',
    displayName: 'Arjun Nair',
    bio: 'Certified refrigeration & kitchen thermal specialist covering inverter compressor relay diagnostics, evaporator fan assemblies, and microwave high-voltage testing.',
    serviceCategories: ['refrigerator', 'microwave', 'other'],
    skills: [
      'Inverter Compressor Relay',
      'Evaporator Defrost Diagnostics',
      'Waveguide & Interlock Testing',
      'GFCI Fault Isolation',
    ],
    experienceYears: 8,
    serviceArea: 'Indiranagar & Bengaluru Central',
    availabilityStatus: 'available',
    verificationStatus: 'verified',
    ratingAvg: 4.8,
    completedJobs: 42,
  },
  {
    uid: 'tech_meera_kulkarni',
    displayName: 'Meera Kulkarni',
    bio: 'Senior front-load & top-load laundry technician specializing in drain pump impellers, suspension dampers, inlet solenoid valves, and pressure switches.',
    serviceCategories: ['washing_machine', 'microwave', 'other'],
    skills: [
      'Drain Pump Replacement',
      'Drum Bearing & Shock Absorbers',
      'Inlet Solenoid Diagnostics',
    ],
    experienceYears: 6,
    serviceArea: 'Koramangala & HSR Layout',
    availabilityStatus: 'available',
    verificationStatus: 'verified',
    ratingAvg: 4.7,
    completedJobs: 31,
  },
  {
    uid: 'tech_vikram_deshmukh',
    displayName: 'Vikram Deshmukh',
    bio: 'HVAC & split inverter cooling engineer focusing on condenser run capacitors, nitrogen leak pressure checks, and condensate drain line servicing.',
    serviceCategories: ['air_conditioner', 'refrigerator'],
    skills: [
      'Split AC Condenser Diagnostics',
      'Refrigerant Leak Testing',
      'Condensate Drain Flushing',
    ],
    experienceYears: 9,
    serviceArea: 'Whitefield & Marathahalli',
    availabilityStatus: 'available',
    verificationStatus: 'verified',
    ratingAvg: 4.9,
    completedJobs: 58,
  },
  {
    uid: 'tech_rohan_iyer',
    displayName: 'Rohan Iyer',
    bio: 'Consumer electronics & computing hardware specialist handling laptop thermal repasting, USB-C power rail diagnosis, and LED TV backlight strips.',
    serviceCategories: ['laptop', 'television', 'other'],
    skills: [
      'LED Backlight Driver Repair',
      'Laptop Thermal Repasting',
      'Power Rail & DC Jack Diagnostics',
    ],
    experienceYears: 5,
    serviceArea: 'Jayanagar & JP Nagar',
    availabilityStatus: 'available',
    verificationStatus: 'verified',
    ratingAvg: 4.6,
    completedJobs: 24,
  },
];

export const SAMPLE_VERIFIED_TECHNICIANS = VERIFIED_TECHNICIANS_DIRECTORY;


