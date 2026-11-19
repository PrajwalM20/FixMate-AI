import type { ApplianceSlug, RiskLevel } from '../../src/types/domain.ts';

export interface FactDescriptor {
  id: string;
  label: string;
  keywords: string[];
}

export interface KnowledgeRule {
  id: string;
  applianceCategory: ApplianceSlug | 'any';
  antecedents: string[];
  negatedAntecedents?: string[];
  consequentFact: string;
  description: string;
  suggestedCauseId?: string;
}

export interface CauseDefinition {
  id: string;
  applianceCategory: ApplianceSlug;
  faultTitle: string;
  possibleCause: string;
  explanation: string;
  requiredFacts: string[];
  supportingFacts: string[];
  contradictoryFacts: string[];
  missingInfoPrompts: string[];
  safeSteps: string[];
  riskLevel: RiskLevel;
  requiresProfessional: boolean;
  basePriorWeight: number;
}

export interface GraphNodeDef {
  id: string;
  label: string;
  nodeType: 'start' | 'check' | 'cause' | 'goal_safe' | 'goal_escalate';
  safeActionStep?: string;
  linkedCauseId?: string;
}

export interface GraphEdgeDef {
  from: string;
  to: string;
  reason: string;
  preferredFacts?: string[];
}

export interface TroubleshootingGraphDef {
  applianceCategory: ApplianceSlug;
  startNodeId: string;
  nodes: Record<string, GraphNodeDef>;
  edges: GraphEdgeDef[];
}

export const HAZARD_FACTS: Record<string, { label: string; keywords: string[]; warning: string }> = {
  hazard_smoke: {
    label: 'Visible smoke',
    keywords: ['smoke', 'smoking', 'fumes'],
    warning: 'Visible smoke indicates active thermal or electrical failure. Shut off power immediately if safe.',
  },
  hazard_burning_smell: {
    label: 'Burning odor',
    keywords: ['burning smell', 'burnt smell', 'melted plastic', 'acrid smell', 'burning odor'],
    warning: 'A burning odor suggests overheated wiring, motor windings, or insulation breakdown.',
  },
  hazard_sparks: {
    label: 'Electrical sparking or arcing',
    keywords: ['spark', 'sparks', 'sparking', 'arcing', 'arc', 'flash inside'],
    warning: 'Electrical arcing poses fire and shock hazards. Disconnect from mains immediately if safe.',
  },
  hazard_exposed_wiring: {
    label: 'Exposed or frayed electrical wiring',
    keywords: ['exposed wire', 'exposed wiring', 'frayed cord', 'bare wire', 'damaged cord'],
    warning: 'Exposed wiring creates a severe electrocution hazard. Do not touch the cord or metal chassis.',
  },
  hazard_gas_leak: {
    label: 'Suspected gas leakage',
    keywords: ['gas smell', 'gas leak', 'rotten egg', 'refrigerant hiss', 'propane', 'natural gas'],
    warning: 'Suspected gas leak detected. Evacuate area, avoid sparks/switches, and contact emergency services.',
  },
  hazard_water_near_electrical: {
    label: 'Water near live electrical components',
    keywords: ['water near outlet', 'water on circuit', 'water near plug', 'flooding electrical', 'wet socket'],
    warning: 'Water near electrical circuits creates shock risk. Shut off the room circuit breaker before approaching.',
  },
  hazard_severe_overheating: {
    label: 'Severe overheating or scorching',
    keywords: ['too hot to touch', 'scorched', 'melting', 'glowing red', 'severe overheating'],
    warning: 'Severe overheating detected. Stop using the appliance and allow complete cooldown with power off.',
  },
};

export const FACT_VOCABULARY: FactDescriptor[] = [
  // General
  { id: 'appliance_running', label: 'Appliance powers on or runs', keywords: ['running', 'turns on', 'powers on', 'motor runs', 'light on', 'spinning'] },
  { id: 'no_power', label: 'Appliance completely fails to power on', keywords: ['not turning on', 'no power', 'dead', 'wont turn on', 'does not turn on', 'no lights'] },
  { id: 'unusual_noise', label: 'Unusual mechanical or humming noise', keywords: ['noise', 'clicking', 'buzzing', 'grinding', 'banging', 'humming', 'loud'] },
  { id: 'poor_ventilation', label: 'Poor ventilation or obstructed airflow', keywords: ['blocked vent', 'dusty', 'poor ventilation', 'air blocked', 'clogged filter', 'no space behind'] },
  { id: 'trips_breaker', label: 'Trips circuit breaker or GFCI', keywords: ['trips breaker', 'breaker trips', 'gfci', 'fuse blows'] },

  // Refrigerator
  { id: 'fridge_not_cooling', label: 'Refrigerator compartment is warm / not cooling', keywords: ['not cooling', 'warm fridge', 'food spoiling', 'fridge warm'] },
  { id: 'freezer_cold', label: 'Freezer compartment remains cold', keywords: ['freezer cold', 'freezer working', 'freezer ok'] },
  { id: 'freezer_warm', label: 'Freezer compartment is also warm', keywords: ['freezer warm', 'ice melting', 'both warm'] },
  { id: 'frost_buildup', label: 'Visible frost or ice buildup on vents/back wall', keywords: ['frost', 'ice buildup', 'frozen wall', 'icy coils'] },
  { id: 'compressor_clicking', label: 'Repeated clicking near rear compressor', keywords: ['clicking', 'click every', 'compressor hot'] },

  // Washing Machine
  { id: 'washer_not_draining', label: 'Washing machine does not drain water', keywords: ['not draining', 'wont drain', 'does not drain', 'no drain', 'drain error'] },
  { id: 'water_in_drum', label: 'Standing water remains inside the drum', keywords: ['water in drum', 'standing water', 'water remains', 'full of water'] },
  { id: 'drain_cycle_incomplete', label: 'Drain or spin cycle fails to complete', keywords: ['cycle stops', 'wont spin', 'does not complete', 'stuck on drain', 'oe error'] },
  { id: 'excessive_vibration', label: 'Severe vibration or shaking during spin', keywords: ['shaking', 'vibrating', 'banging', 'walking across', 'unbalanced'] },

  // Air Conditioner
  { id: 'ac_not_cooling', label: 'Air conditioner is not cooling room', keywords: ['not cooling', 'blowing warm air', 'ambient air', 'room stays hot'] },
  { id: 'ac_airflow_present', label: 'Indoor blower airflow is present', keywords: ['airflow present', 'fan blowing', 'air coming out', 'blower works'] },
  { id: 'ac_weak_airflow', label: 'Indoor airflow is weak or restricted', keywords: ['weak airflow', 'barely blowing', 'dirty filter'] },
  { id: 'outdoor_unit_not_running', label: 'Outdoor condenser fan/unit is not operating', keywords: ['outdoor unit off', 'outdoor unit not running', 'outdoor unit not spinning', 'outdoor fan not spinning', 'condenser silent'] },
  { id: 'outdoor_unit_running', label: 'Outdoor condenser unit appears to be running', keywords: ['outdoor unit running', 'outdoor fan spinning'] },
  { id: 'ac_water_leak', label: 'Water dripping from indoor AC unit', keywords: ['dripping water', 'water leaking', 'wet wall', 'condensate'] },

  // Laptop
  { id: 'laptop_overheating', label: 'Laptop chassis feels very hot / overheating', keywords: ['overheating', 'very hot', 'thermal', 'hot keyboard', 'throttling'] },
  { id: 'laptop_loud_fan', label: 'Cooling fan runs loudly at high speed', keywords: ['loud fan', 'fan loud', 'fan spinning fast', 'fan noise'] },
  { id: 'laptop_sudden_shutdown', label: 'Laptop shuts down unexpectedly under load', keywords: ['sudden shutdown', 'shuts down', 'powers off', 'restarts randomly'] },
  { id: 'laptop_no_boot', label: 'Laptop fails to boot or show display', keywords: ['no display', 'blinking light', 'wont boot', 'black screen'] },

  // Television
  { id: 'tv_no_picture_with_sound', label: 'TV plays audio with black or dim screen', keywords: ['sound no picture', 'audio works', 'black screen', 'flashlight'] },
  { id: 'tv_standby_blinking', label: 'TV standby LED blinks repeatedly', keywords: ['led blinks', 'red light blinking', 'standby blinking'] },

  // Microwave
  { id: 'microwave_no_heat', label: 'Microwave runs without heating food', keywords: ['not heating', 'food stays cold', 'no heat', 'wont heat'] },
  { id: 'microwave_turntable_runs', label: 'Turntable and interior light operate normally', keywords: ['turntable spins', 'light works', 'spins normally'] },
];

export const KNOWLEDGE_RULES: KnowledgeRule[] = [
  // Refrigerator Forward Chaining Rules
  {
    id: 'R_FRIDGE_01',
    applianceCategory: 'refrigerator',
    antecedents: ['appliance_running', 'fridge_not_cooling'],
    consequentFact: 'cooling_system_issue_possible',
    description: 'If refrigerator runs but fails to cool, a cooling-system or airflow issue is possible.',
  },
  {
    id: 'R_FRIDGE_02',
    applianceCategory: 'refrigerator',
    antecedents: ['cooling_system_issue_possible', 'poor_ventilation'],
    consequentFact: 'airflow_restriction_possible',
    description: 'If cooling issue co-occurs with poor ventilation or blocked vents, airflow restriction is possible.',
    suggestedCauseId: 'cause_fridge_airflow_frost',
  },
  {
    id: 'R_FRIDGE_03',
    applianceCategory: 'refrigerator',
    antecedents: ['fridge_not_cooling', 'freezer_cold'],
    consequentFact: 'airflow_restriction_possible',
    description: 'If fresh food section is warm while freezer stays cold, evaporator airflow blockage or frost is possible.',
    suggestedCauseId: 'cause_fridge_airflow_frost',
  },
  {
    id: 'R_FRIDGE_04',
    applianceCategory: 'refrigerator',
    antecedents: ['frost_buildup'],
    consequentFact: 'defrost_or_gasket_check_needed',
    description: 'Frost buildup suggests checking door gasket sealing and defrost airflow paths.',
    suggestedCauseId: 'cause_fridge_airflow_frost',
  },
  {
    id: 'R_FRIDGE_05',
    applianceCategory: 'refrigerator',
    antecedents: ['compressor_clicking', 'fridge_not_cooling'],
    consequentFact: 'compressor_start_circuit_suspect',
    description: 'Repeated clicking paired with warm interior indicates start relay or compressor thermal overload is possible.',
    suggestedCauseId: 'cause_fridge_compressor_relay',
  },
  {
    id: 'R_FRIDGE_06',
    applianceCategory: 'refrigerator',
    antecedents: ['cooling_system_issue_possible', 'unusual_noise'],
    consequentFact: 'collect_additional_cooling_info',
    description: 'Unusual noise during cooling loss requires follow-up questions before ranking mechanical causes.',
    suggestedCauseId: 'cause_fridge_compressor_relay',
  },

  // Washing Machine Forward Chaining Rules
  {
    id: 'R_WASHER_01',
    applianceCategory: 'washing_machine',
    antecedents: ['water_in_drum', 'drain_cycle_incomplete'],
    consequentFact: 'investigate_drainage_system',
    description: 'If water remains in the drum and drain cycle does not complete, investigate the drainage system.',
  },
  {
    id: 'R_WASHER_02',
    applianceCategory: 'washing_machine',
    antecedents: ['washer_not_draining'],
    consequentFact: 'investigate_drainage_system',
    description: 'Reported failure to drain requires checking the drainage path and filter.',
  },
  {
    id: 'R_WASHER_03',
    applianceCategory: 'washing_machine',
    antecedents: ['investigate_drainage_system'],
    consequentFact: 'drainage_obstruction_possible',
    description: 'When investigating the drainage system, a coin-trap or hose blockage is a possible cause.',
    suggestedCauseId: 'cause_washer_drain_blockage',
  },
  {
    id: 'R_WASHER_04',
    applianceCategory: 'washing_machine',
    antecedents: ['investigate_drainage_system', 'unusual_noise'],
    consequentFact: 'drain_pump_impeller_possible',
    description: 'Unusual humming or grinding during failed drain suggests a jammed pump impeller or failing drain motor.',
    suggestedCauseId: 'cause_washer_drain_pump',
  },
  {
    id: 'R_WASHER_05',
    applianceCategory: 'washing_machine',
    antecedents: ['excessive_vibration'],
    consequentFact: 'drum_balance_or_leveling_possible',
    description: 'Violent shaking during spin indicates unbalanced laundry load or unleveled feet.',
    suggestedCauseId: 'cause_washer_vibration',
  },

  // Air Conditioner Forward Chaining Rules
  {
    id: 'R_AC_01',
    applianceCategory: 'air_conditioner',
    antecedents: ['ac_not_cooling', 'appliance_running'],
    consequentFact: 'ac_cooling_loss_active',
    description: 'AC powers on but does not cool; evaluate indoor airflow and outdoor unit state.',
  },
  {
    id: 'R_AC_02',
    applianceCategory: 'air_conditioner',
    antecedents: ['ac_not_cooling', 'ac_weak_airflow'],
    consequentFact: 'ac_filter_restriction_possible',
    description: 'Weak indoor airflow paired with poor cooling suggests clogged indoor mesh filters or coil dust.',
    suggestedCauseId: 'cause_ac_dirty_filter',
  },
  {
    id: 'R_AC_03',
    applianceCategory: 'air_conditioner',
    antecedents: ['ac_not_cooling', 'outdoor_unit_not_running'],
    consequentFact: 'ac_condenser_or_capacitor_possible',
    description: 'Indoor unit runs while outdoor unit is idle; capacitor, breaker, or compressor control fault is possible.',
    suggestedCauseId: 'cause_ac_outdoor_fault',
  },
  {
    id: 'R_AC_04',
    applianceCategory: 'air_conditioner',
    antecedents: ['ac_not_cooling', 'outdoor_unit_running'],
    consequentFact: 'ac_refrigerant_or_coil_possible',
    description: 'Both indoor and outdoor units run without cooling; low refrigerant or fouled condenser coils may be involved.',
    suggestedCauseId: 'cause_ac_outdoor_fault',
  },
  {
    id: 'R_AC_05',
    applianceCategory: 'air_conditioner',
    antecedents: ['ac_water_leak'],
    consequentFact: 'ac_condensate_drain_blocked_possible',
    description: 'Indoor water dripping points to a blocked condensate drain line or frozen evaporator coil.',
    suggestedCauseId: 'cause_ac_drain_leak',
  },

  // Laptop Forward Chaining Rules
  {
    id: 'R_LAPTOP_01',
    applianceCategory: 'laptop',
    antecedents: ['laptop_overheating', 'laptop_loud_fan'],
    consequentFact: 'thermal_dissipation_degraded',
    description: 'High heat with maximum fan speed indicates obstructed cooling vents or degraded thermal paste.',
    suggestedCauseId: 'cause_laptop_thermal',
  },
  {
    id: 'R_LAPTOP_02',
    applianceCategory: 'laptop',
    antecedents: ['laptop_overheating', 'laptop_sudden_shutdown'],
    consequentFact: 'thermal_protection_shutdown_possible',
    description: 'Sudden power-off under heat suggests hardware thermal trip protection.',
    suggestedCauseId: 'cause_laptop_thermal',
  },
  {
    id: 'R_LAPTOP_03',
    applianceCategory: 'laptop',
    antecedents: ['no_power'],
    consequentFact: 'laptop_power_rail_or_adapter_possible',
    description: 'Failure to power on requires verifying AC adapter, wall outlet, and battery reset.',
    suggestedCauseId: 'cause_laptop_power',
  },

  // Television Forward Chaining Rules
  {
    id: 'R_TV_01',
    applianceCategory: 'television',
    antecedents: ['no_power'],
    consequentFact: 'tv_power_supply_or_outlet_possible',
    description: 'TV not turning on requires verifying wall outlet, remote batteries, and internal power board symptoms.',
    suggestedCauseId: 'cause_tv_no_power',
  },
  {
    id: 'R_TV_02',
    applianceCategory: 'television',
    antecedents: ['tv_no_picture_with_sound'],
    consequentFact: 'tv_backlight_fault_possible',
    description: 'Audio present with black display suggests LED backlight strip or driver board failure.',
    suggestedCauseId: 'cause_tv_backlight',
  },
  {
    id: 'R_TV_03',
    applianceCategory: 'television',
    antecedents: ['tv_standby_blinking'],
    consequentFact: 'tv_power_supply_or_outlet_possible',
    description: 'Blinking standby indicator signals power-rail protection fault.',
    suggestedCauseId: 'cause_tv_no_power',
  },

  // Microwave Forward Chaining Rules
  {
    id: 'R_MW_01',
    applianceCategory: 'microwave',
    antecedents: ['microwave_no_heat', 'appliance_running'],
    consequentFact: 'microwave_high_voltage_heating_fault',
    description: 'Microwave runs without heating; magnetron, high-voltage diode, or door switch fault is possible.',
    suggestedCauseId: 'cause_microwave_no_heat',
  },
  {
    id: 'R_MW_02',
    applianceCategory: 'microwave',
    antecedents: ['microwave_no_heat', 'microwave_turntable_runs'],
    consequentFact: 'microwave_high_voltage_heating_fault',
    description: 'Turntable and light operating without heat isolates the fault from mains power to the heating circuit.',
    suggestedCauseId: 'cause_microwave_no_heat',
  },

  // Cross-category rules
  {
    id: 'R_ANY_01',
    applianceCategory: 'any',
    antecedents: ['trips_breaker'],
    consequentFact: 'electrical_ground_fault_possible',
    description: 'Repeated breaker tripping indicates a possible short circuit or ground fault requiring technician testing.',
    suggestedCauseId: 'cause_general_electrical_trip',
  },
];

export const CAUSE_DEFINITIONS: CauseDefinition[] = [
  {
    id: 'cause_fridge_airflow_frost',
    applianceCategory: 'refrigerator',
    faultTitle: 'Airflow Obstruction or Evaporator Frost Buildup',
    possibleCause: 'Blocked internal air vents, worn door gasket, or defrost system frost accumulation',
    explanation:
      'When the compressor runs and the freezer stays cold while the fresh-food compartment warms, cold air is often unable to circulate through frosted or blocked damper vents.',
    requiredFacts: ['fridge_not_cooling'],
    supportingFacts: ['appliance_running', 'freezer_cold', 'frost_buildup', 'poor_ventilation', 'airflow_restriction_possible'],
    contradictoryFacts: ['no_power'],
    missingInfoPrompts: [
      'Confirm whether the freezer compartment is still freezing normally.',
      'Check whether frost covers the rear interior freezer wall.',
    ],
    safeSteps: [
      'Verify interior air vents between freezer and fridge are not blocked by food containers.',
      'Inspect magnetic door gaskets for gaps or debris preventing a tight seal.',
      'Check exterior rear/side clearance (at least 5–10 cm) for condenser ventilation.',
      'If heavy frost is visible on the back panel, unplug the unit for 12 hours with towels placed underneath to defrost.',
    ],
    riskLevel: 'medium',
    requiresProfessional: false,
    basePriorWeight: 0.55,
  },
  {
    id: 'cause_fridge_compressor_relay',
    applianceCategory: 'refrigerator',
    faultTitle: 'Compressor Start Relay Overload or Sealed Cooling Fault',
    possibleCause: 'Faulty PTC start relay, dust-choked condenser coils, or compressor motor fault',
    explanation:
      'Repeated clicking accompanied by warm temperatures in both compartments suggests the compressor is attempting to start and tripping its thermal overload protector.',
    requiredFacts: ['fridge_not_cooling'],
    supportingFacts: ['compressor_clicking', 'freezer_warm', 'unusual_noise', 'compressor_start_circuit_suspect'],
    contradictoryFacts: ['freezer_cold'],
    missingInfoPrompts: [
      'Note whether a clicking sound repeats every 2–5 minutes near the lower rear panel.',
      'Check if both the freezer and refrigerator sections are warm.',
    ],
    safeSteps: [
      'Unplug the refrigerator if clicking repeats continuously to prevent relay overheating.',
      'Gently vacuum visible dust from accessible rear or bottom condenser grilles.',
      'Plug directly into a wall outlet rather than a loose extension strip and observe for 30 minutes.',
      'If cooling does not resume, book a certified refrigeration technician.',
    ],
    riskLevel: 'high',
    requiresProfessional: true,
    basePriorWeight: 0.45,
  },
  {
    id: 'cause_washer_drain_blockage',
    applianceCategory: 'washing_machine',
    faultTitle: 'Clogged Drain Filter (Coin Trap) or Kinked Drain Hose',
    possibleCause: 'Lint, coins, or small fabric obstructions blocking water discharge',
    explanation:
      'Standing water remaining in the drum after an incomplete drain cycle is frequently caused by debris trapped in the user-serviceable lower pump filter or a kinked external hose.',
    requiredFacts: ['washer_not_draining'],
    supportingFacts: ['water_in_drum', 'drain_cycle_incomplete', 'investigate_drainage_system', 'drainage_obstruction_possible'],
    contradictoryFacts: ['no_power'],
    missingInfoPrompts: [
      'Confirm whether an error code appears on the washer display.',
      'Check whether the lower front drain filter has been cleaned recently.',
    ],
    safeSteps: [
      'Unplug the washing machine and turn off the water inlet taps.',
      'Place shallow towels and a tray beneath the lower front filter access door.',
      'Slowly drain residual water via the small emergency tube and clear debris from the coin trap filter.',
      'Check the rear drain hose for sharp kinks or vertical height blockages.',
    ],
    riskLevel: 'low',
    requiresProfessional: false,
    basePriorWeight: 0.6,
  },
  {
    id: 'cause_washer_drain_pump',
    applianceCategory: 'washing_machine',
    faultTitle: 'Jammed or Failing Drain Pump Motor',
    possibleCause: 'Obstructed pump impeller or worn drain pump winding',
    explanation:
      'If the drain trap is clear yet the washer hums or fails to pump out standing water, the electric drain pump motor may be jammed or electrically open.',
    requiredFacts: ['washer_not_draining'],
    supportingFacts: ['unusual_noise', 'water_in_drum', 'drain_pump_impeller_possible'],
    contradictoryFacts: [],
    missingInfoPrompts: [
      'Listen for a humming or grinding sound during the drain phase.',
    ],
    safeSteps: [
      'Ensure the coin trap filter is clean and free of coins or pins.',
      'Run a short Spin & Drain test once the trap is clear.',
      'If water still does not discharge, discontinue cycles and schedule a technician to test the drain pump.',
    ],
    riskLevel: 'medium',
    requiresProfessional: true,
    basePriorWeight: 0.42,
  },
  {
    id: 'cause_washer_vibration',
    applianceCategory: 'washing_machine',
    faultTitle: 'Unbalanced Drum Load or Unleveled Cabinet Feet',
    possibleCause: 'Uneven laundry distribution or loose adjustable leveling feet',
    explanation:
      'Heavy knocking during spin cycles typically results from a single heavy item bunching on one side or uneven floor contact.',
    requiredFacts: ['excessive_vibration'],
    supportingFacts: ['unusual_noise', 'drum_balance_or_leveling_possible'],
    contradictoryFacts: [],
    missingInfoPrompts: ['Confirm if vibration persists with a balanced medium load.'],
    safeSteps: [
      'Pause the cycle and redistribute wet towels or bedding evenly around the drum.',
      'Check that all four feet sit firmly on the floor and tighten leveling locknuts.',
    ],
    riskLevel: 'low',
    requiresProfessional: false,
    basePriorWeight: 0.58,
  },
  {
    id: 'cause_ac_dirty_filter',
    applianceCategory: 'air_conditioner',
    faultTitle: 'Restricted Indoor Airflow or Clogged Return Air Filters',
    possibleCause: 'Dust-saturated indoor mesh filters restricting heat exchange across the evaporator coil',
    explanation:
      'Blocked indoor filters starve the indoor coil of airflow, reducing cooling output and sometimes causing indoor coil icing or dripping.',
    requiredFacts: ['ac_not_cooling'],
    supportingFacts: ['ac_weak_airflow', 'poor_ventilation', 'ac_filter_restriction_possible'],
    contradictoryFacts: ['no_power'],
    missingInfoPrompts: [
      'Check whether strong cool or ambient airflow exits the indoor vents.',
    ],
    safeSteps: [
      'Turn off the AC and verify remote mode is set to Cool at least 4C below room temperature.',
      'Remove and rinse the washable indoor mesh dust filters with clean water; dry thoroughly before reinstalling.',
      'Ensure curtains or furniture are not obstructing the indoor return intake.',
    ],
    riskLevel: 'low',
    requiresProfessional: false,
    basePriorWeight: 0.55,
  },
  {
    id: 'cause_ac_outdoor_fault',
    applianceCategory: 'air_conditioner',
    faultTitle: 'Outdoor Condenser Idle, Capacitor Fault, or Refrigerant Issue',
    possibleCause: 'Tripped outdoor breaker, failed run capacitor, or low refrigerant charge',
    explanation:
      'When the indoor blower operates normally without cooling room air—especially if the outdoor fan is idle—the fault likely involves the outdoor condenser unit or sealed refrigerant loop.',
    requiredFacts: ['ac_not_cooling'],
    supportingFacts: ['outdoor_unit_not_running', 'outdoor_unit_running', 'ac_airflow_present', 'ac_condenser_or_capacitor_possible', 'ac_refrigerant_or_coil_possible'],
    contradictoryFacts: [],
    missingInfoPrompts: [
      'Observe safely from indoors/window whether the outdoor condenser fan is spinning.',
    ],
    safeSteps: [
      'Check that the outdoor unit has unobstructed surrounding clearance (no leaves or covers).',
      'Verify the dedicated AC circuit breaker has not tripped.',
      'Do NOT open the outdoor electrical housing or touch refrigerant copper lines. Book a certified HVAC technician.',
    ],
    riskLevel: 'high',
    requiresProfessional: true,
    basePriorWeight: 0.48,
  },
  {
    id: 'cause_ac_drain_leak',
    applianceCategory: 'air_conditioner',
    faultTitle: 'Blocked Condensate Drain Line',
    possibleCause: 'Algae or dust sludge blocking indoor condensate drainage',
    explanation:
      'Condensation collected on the indoor evaporator overflows down the wall when the drain tube is obstructed.',
    requiredFacts: ['ac_water_leak'],
    supportingFacts: ['ac_condensate_drain_blocked_possible'],
    contradictoryFacts: [],
    missingInfoPrompts: ['Check if water exits the external drain pipe outdoors during cooling.'],
    safeSteps: [
      'Switch off the AC immediately if water is near wall sockets.',
      'Inspect the outdoor tip of the drain hose for kinks or blockage.',
      'Schedule technician drain-line flushing if indoor dripping continues.',
    ],
    riskLevel: 'medium',
    requiresProfessional: true,
    basePriorWeight: 0.55,
  },
  {
    id: 'cause_laptop_thermal',
    applianceCategory: 'laptop',
    faultTitle: 'Dust-Obstructed Cooling Fins or Degraded Thermal Paste',
    possibleCause: 'Blocked intake/exhaust airflow paths or aged CPU/GPU thermal compound',
    explanation:
      'High chassis temperatures paired with loud fan spin or sudden thermal shutdowns indicate heat cannot transfer efficiently away from the processor.',
    requiredFacts: ['laptop_overheating'],
    supportingFacts: ['laptop_loud_fan', 'laptop_sudden_shutdown', 'poor_ventilation', 'thermal_dissipation_degraded', 'thermal_protection_shutdown_possible'],
    contradictoryFacts: ['no_power'],
    missingInfoPrompts: [
      'Confirm whether overheating occurs mainly on soft surfaces (bed/lap) or under heavy apps.',
    ],
    safeSteps: [
      'Place the laptop on a hard, flat desk to keep bottom intake vents unobstructed.',
      'Shut down, unplug the charger, and clear dust gently from exterior vents using short bursts of compressed air.',
      'Check Task Manager / Activity Monitor for runaway background CPU tasks.',
      'If thermal shutdowns persist, schedule technician internal fan cleaning and thermal repasting.',
    ],
    riskLevel: 'low',
    requiresProfessional: false,
    basePriorWeight: 0.62,
  },
  {
    id: 'cause_laptop_power',
    applianceCategory: 'laptop',
    faultTitle: 'Faulty AC Power Adapter, Charging Port, or Power Rail Fault',
    possibleCause: 'Failed external charger, embedded controller lockup, or motherboard power issue',
    explanation:
      'Complete absence of power or blinking charging indicators points to the external adapter, battery, or internal power delivery stage.',
    requiredFacts: ['no_power'],
    supportingFacts: ['laptop_no_boot', 'laptop_power_rail_or_adapter_possible'],
    contradictoryFacts: ['appliance_running'],
    missingInfoPrompts: ['Confirm whether any charging LED lights up when plugged into a known-good wall socket.'],
    safeSteps: [
      'Test the wall outlet with another device and inspect the charger cable for kinks.',
      'Unplug the charger and hold the power button for 20 seconds to perform a static reset.',
      'If zero response persists, consult a laptop repair technician.',
    ],
    riskLevel: 'medium',
    requiresProfessional: true,
    basePriorWeight: 0.5,
  },
  {
    id: 'cause_tv_no_power',
    applianceCategory: 'television',
    faultTitle: 'Outlet/Cord Issue or Internal Power Supply Board Fault',
    possibleCause: 'Switched wall socket, surge strip failure, or failed TV power supply rail',
    explanation:
      'A television that shows no picture and no standby response—or flashes a standby error code—may have an external power issue or an internal power supply fault.',
    requiredFacts: ['no_power'],
    supportingFacts: ['tv_standby_blinking', 'tv_power_supply_or_outlet_possible'],
    contradictoryFacts: ['tv_no_picture_with_sound'],
    missingInfoPrompts: [
      'Check if the standby indicator light turns on or blinks when pressing the physical TV power button.',
    ],
    safeSteps: [
      'Test the wall outlet directly (bypassing power strips) and verify the power cord sits firmly.',
      'Unplug the TV for 60 seconds, hold the physical power button on the TV chassis for 15 seconds, then reconnect.',
      'Do NOT open the rear television panel due to retained capacitor voltage. Book a TV technician if unresponsive.',
    ],
    riskLevel: 'high',
    requiresProfessional: true,
    basePriorWeight: 0.52,
  },
  {
    id: 'cause_tv_backlight',
    applianceCategory: 'television',
    faultTitle: 'LED Backlight Strip or Backlight Driver Failure',
    possibleCause: 'Open-circuit LED backlight array or failing LED driver output',
    explanation:
      'Normal audio playback with a completely dark screen usually means the main board and LCD panel are working while the backlight illumination has failed.',
    requiredFacts: ['tv_no_picture_with_sound'],
    supportingFacts: ['appliance_running', 'tv_backlight_fault_possible'],
    contradictoryFacts: ['no_power'],
    missingInfoPrompts: ['Shine a flashlight closely at the screen while audio plays to check for a faint image.'],
    safeSteps: [
      'Power-cycle the television from the wall outlet for 60 seconds and check active input source.',
      'Do NOT disassemble the TV casing. Backlight replacement requires a qualified technician.',
    ],
    riskLevel: 'high',
    requiresProfessional: true,
    basePriorWeight: 0.56,
  },
  {
    id: 'cause_microwave_no_heat',
    applianceCategory: 'microwave',
    faultTitle: 'High-Voltage Heating Circuit or Magnetron Failure',
    possibleCause: 'Failed magnetron, high-voltage diode/capacitor, or misaligned door interlock switch',
    explanation:
      'When the turntable spins and light illuminates without warming food, mains power reaches the control board but high-voltage microwave generation is interrupted.',
    requiredFacts: ['microwave_no_heat'],
    supportingFacts: ['appliance_running', 'microwave_turntable_runs', 'unusual_noise', 'microwave_high_voltage_heating_fault'],
    contradictoryFacts: ['no_power'],
    missingInfoPrompts: ['Confirm whether timer/power level is set to 100% Cook (not Kitchen Timer).'],
    safeSteps: [
      'Verify the door closes flush and the oven is set to Cook mode at full power (not Demo or Timer mode).',
      'STOP HERE: Never open a microwave casing. Internal high-voltage capacitors store lethal charge even unplugged. Contact a certified technician.',
    ],
    riskLevel: 'critical',
    requiresProfessional: true,
    basePriorWeight: 0.65,
  },
  {
    id: 'cause_general_electrical_trip',
    applianceCategory: 'other',
    faultTitle: 'Electrical Insulation Breakdown or Ground Fault',
    possibleCause: 'Damaged power cord, moisture ingress, or internal heating/motor short',
    explanation:
      'Immediate tripping of a circuit breaker or GFCI outlet indicates leakage current to ground.',
    requiredFacts: ['trips_breaker'],
    supportingFacts: ['electrical_ground_fault_possible'],
    contradictoryFacts: [],
    missingInfoPrompts: ['Confirm if the breaker trips immediately on plug-in or only when a cycle starts.'],
    safeSteps: [
      'Unplug the appliance immediately and do NOT repeatedly force the breaker back on.',
      'Inspect the external cord for visible cuts or heat marks without touching bare conductors.',
      'Request a certified electrical appliance technician.',
    ],
    riskLevel: 'critical',
    requiresProfessional: true,
    basePriorWeight: 0.6,
  },
];

export const TROUBLESHOOTING_GRAPHS: Record<ApplianceSlug, TroubleshootingGraphDef> = {
  refrigerator: {
    applianceCategory: 'refrigerator',
    startNodeId: 'fridge_start',
    nodes: {
      fridge_start: { id: 'fridge_start', label: 'Start: Refrigerator Cooling Issue', nodeType: 'start' },
      fridge_chk_power: {
        id: 'fridge_chk_power',
        label: 'Level 1: Check power, thermostat & interior fan',
        nodeType: 'check',
        safeActionStep: 'Confirm outlet power, thermostat setpoint, and whether interior fan runs.',
      },
      fridge_chk_vents: {
        id: 'fridge_chk_vents',
        label: 'Level 1: Check door gaskets, airflow vents & rear clearance',
        nodeType: 'check',
        safeActionStep: 'Verify interior vents and exterior condenser clearance are unobstructed.',
      },
      fridge_chk_noise: {
        id: 'fridge_chk_noise',
        label: 'Level 2: Check freezer temp vs. compressor clicking',
        nodeType: 'check',
        safeActionStep: 'Observe if freezer stays cold or if rear compressor clicks repeatedly.',
      },
      fridge_goal_defrost: {
        id: 'fridge_goal_defrost',
        label: 'Goal: Safe vent clearance & controlled defrost',
        nodeType: 'goal_safe',
        linkedCauseId: 'cause_fridge_airflow_frost',
        safeActionStep: 'Clear interior vents, clean gaskets, or perform a 12-hour unplugged defrost if frosted.',
      },
      fridge_goal_tech: {
        id: 'fridge_goal_tech',
        label: 'Goal: Schedule technician for relay / sealed cooling check',
        nodeType: 'goal_escalate',
        linkedCauseId: 'cause_fridge_compressor_relay',
        safeActionStep: 'Unplug unit if clicking persists and contact a certified refrigeration technician.',
      },
    },
    edges: [
      { from: 'fridge_start', to: 'fridge_chk_power', reason: 'Verify mains power and cooling demand state first' },
      { from: 'fridge_start', to: 'fridge_chk_vents', reason: 'Inspect non-invasive airflow and door seal state' },
      { from: 'fridge_chk_power', to: 'fridge_chk_noise', reason: 'Separate airflow issues from compressor start faults', preferredFacts: ['compressor_clicking', 'freezer_warm'] },
      { from: 'fridge_chk_vents', to: 'fridge_goal_defrost', reason: 'Airflow or frost evidence points to safe defrost & clearance', preferredFacts: ['freezer_cold', 'frost_buildup', 'poor_ventilation'] },
      { from: 'fridge_chk_noise', to: 'fridge_goal_tech', reason: 'Clicking or warm freezer requires professional relay/cooling check', preferredFacts: ['compressor_clicking', 'freezer_warm', 'unusual_noise'] },
      { from: 'fridge_chk_noise', to: 'fridge_goal_defrost', reason: 'If freezer is cold without clicking, follow safe defrost path', preferredFacts: ['freezer_cold'] },
    ],
  },
  washing_machine: {
    applianceCategory: 'washing_machine',
    startNodeId: 'washer_start',
    nodes: {
      washer_start: { id: 'washer_start', label: 'Start: Washing Machine Fault', nodeType: 'start' },
      washer_chk_drain: {
        id: 'washer_chk_drain',
        label: 'Level 1: Confirm standing water & drain error code',
        nodeType: 'check',
        safeActionStep: 'Check drum water level and note any panel error codes.',
      },
      washer_chk_balance: {
        id: 'washer_chk_balance',
        label: 'Level 1: Check load balance & leveling feet',
        nodeType: 'check',
        safeActionStep: 'Verify laundry distribution and floor leveling.',
      },
      washer_chk_trap: {
        id: 'washer_chk_trap',
        label: 'Level 2: Inspect lower coin trap filter & rear hose',
        nodeType: 'check',
        safeActionStep: 'Unplug washer and check coin trap and drain hose kinks.',
      },
      washer_goal_clear: {
        id: 'washer_goal_clear',
        label: 'Goal: Safe drain trap cleaning or load rebalance',
        nodeType: 'goal_safe',
        linkedCauseId: 'cause_washer_drain_blockage',
        safeActionStep: 'Clear coin trap / unkink drain hose and test Spin & Drain.',
      },
      washer_goal_pump: {
        id: 'washer_goal_pump',
        label: 'Goal: Escalate to technician for drain pump test',
        nodeType: 'goal_escalate',
        linkedCauseId: 'cause_washer_drain_pump',
        safeActionStep: 'Stop running cycles and book a technician if pump hums without draining.',
      },
    },
    edges: [
      { from: 'washer_start', to: 'washer_chk_drain', reason: 'Check whether water remains in drum', preferredFacts: ['washer_not_draining', 'water_in_drum'] },
      { from: 'washer_start', to: 'washer_chk_balance', reason: 'Evaluate mechanical vibration during spin', preferredFacts: ['excessive_vibration'] },
      { from: 'washer_chk_drain', to: 'washer_chk_trap', reason: 'Inspect user-serviceable drainage path before suspecting motor failure', preferredFacts: ['washer_not_draining', 'water_in_drum'] },
      { from: 'washer_chk_balance', to: 'washer_goal_clear', reason: 'Rebalance laundry load and level feet safely', preferredFacts: ['excessive_vibration'] },
      { from: 'washer_chk_trap', to: 'washer_goal_clear', reason: 'Trap or hose blockage resolved with safe cleaning', preferredFacts: ['drainage_obstruction_possible'] },
      { from: 'washer_chk_trap', to: 'washer_goal_pump', reason: 'Unusual drain noise or persistent failure indicates pump inspection', preferredFacts: ['unusual_noise', 'drain_pump_impeller_possible'] },
    ],
  },
  air_conditioner: {
    applianceCategory: 'air_conditioner',
    startNodeId: 'ac_start',
    nodes: {
      ac_start: { id: 'ac_start', label: 'Start: AC Cooling / Leak Issue', nodeType: 'start' },
      ac_chk_power_mode: {
        id: 'ac_chk_power_mode',
        label: 'Level 1: Check power, Cool mode & indoor airflow',
        nodeType: 'check',
        safeActionStep: 'Verify AC powers on in Cool mode and check if indoor fan blows air.',
      },
      ac_chk_outdoor: {
        id: 'ac_chk_outdoor',
        label: 'Level 1: Observe outdoor unit operation & indoor filters',
        nodeType: 'check',
        safeActionStep: 'Check washable indoor filters and observe whether outdoor fan runs.',
      },
      ac_goal_filter: {
        id: 'ac_goal_filter',
        label: 'Goal: Clean indoor mesh filters & clear return intake',
        nodeType: 'goal_safe',
        linkedCauseId: 'cause_ac_dirty_filter',
        safeActionStep: 'Wash indoor mesh dust filters and ensure unobstructed airflow.',
      },
      ac_goal_hvac: {
        id: 'ac_goal_hvac',
        label: 'Goal: Book certified HVAC technician (condenser / refrigerant)',
        nodeType: 'goal_escalate',
        linkedCauseId: 'cause_ac_outdoor_fault',
        safeActionStep: 'Do not open outdoor electrical panels or refrigerant lines; schedule HVAC inspection.',
      },
    },
    edges: [
      { from: 'ac_start', to: 'ac_chk_power_mode', reason: 'Verify power state, thermostat mode, and indoor blower airflow' },
      { from: 'ac_start', to: 'ac_chk_outdoor', reason: 'Check indoor filter condition and outdoor condenser status' },
      { from: 'ac_chk_power_mode', to: 'ac_goal_filter', reason: 'Weak airflow points to safe indoor filter cleaning', preferredFacts: ['ac_weak_airflow', 'poor_ventilation'] },
      { from: 'ac_chk_outdoor', to: 'ac_goal_hvac', reason: 'Outdoor unit idle or refrigerant suspicion requires HVAC specialist', preferredFacts: ['outdoor_unit_not_running', 'outdoor_unit_running', 'ac_water_leak'] },
      { from: 'ac_chk_power_mode', to: 'ac_goal_hvac', reason: 'Cooling failure with normal airflow requires condenser/refrigerant check', preferredFacts: ['ac_airflow_present'] },
    ],
  },
  laptop: {
    applianceCategory: 'laptop',
    startNodeId: 'laptop_start',
    nodes: {
      laptop_start: { id: 'laptop_start', label: 'Start: Laptop Thermal / Power Issue', nodeType: 'start' },
      laptop_chk_vents: {
        id: 'laptop_chk_vents',
        label: 'Level 1: Check surface ventilation & fan noise',
        nodeType: 'check',
        safeActionStep: 'Move laptop to a hard desk and listen for exhaust fan operation.',
      },
      laptop_chk_power: {
        id: 'laptop_chk_power',
        label: 'Level 1: Verify AC adapter, outlet & charging LED',
        nodeType: 'check',
        safeActionStep: 'Test outlet and adapter connector.',
      },
      laptop_goal_cool: {
        id: 'laptop_goal_cool',
        label: 'Goal: Safe external vent cleaning & CPU load check',
        nodeType: 'goal_safe',
        linkedCauseId: 'cause_laptop_thermal',
        safeActionStep: 'Clear exterior vents with compressed air and verify Task Manager CPU usage.',
      },
      laptop_goal_tech: {
        id: 'laptop_goal_tech',
        label: 'Goal: Service bench inspection (thermal paste / power rail)',
        nodeType: 'goal_escalate',
        linkedCauseId: 'cause_laptop_power',
        safeActionStep: 'Consult technician if sudden shutdowns or no-power persist.',
      },
    },
    edges: [
      { from: 'laptop_start', to: 'laptop_chk_vents', reason: 'Assess airflow and heat dissipation first', preferredFacts: ['laptop_overheating', 'laptop_loud_fan'] },
      { from: 'laptop_start', to: 'laptop_chk_power', reason: 'Assess charger and power indicator state', preferredFacts: ['no_power', 'laptop_no_boot'] },
      { from: 'laptop_chk_vents', to: 'laptop_goal_cool', reason: 'External vent clearing is safe first step', preferredFacts: ['laptop_overheating', 'laptop_loud_fan'] },
      { from: 'laptop_chk_vents', to: 'laptop_goal_tech', reason: 'Repeated thermal shutdowns require repasting or fan service', preferredFacts: ['laptop_sudden_shutdown'] },
      { from: 'laptop_chk_power', to: 'laptop_goal_tech', reason: 'Persistent no-boot needs hardware power rail testing', preferredFacts: ['no_power', 'laptop_no_boot'] },
    ],
  },
  television: {
    applianceCategory: 'television',
    startNodeId: 'tv_start',
    nodes: {
      tv_start: { id: 'tv_start', label: 'Start: Television Display / Power Fault', nodeType: 'start' },
      tv_chk_outlet: {
        id: 'tv_chk_outlet',
        label: 'Level 1: Check wall outlet, standby LED & power cycle',
        nodeType: 'check',
        safeActionStep: 'Verify wall socket directly and perform 60-second unplug reset.',
      },
      tv_chk_audio: {
        id: 'tv_chk_audio',
        label: 'Level 1: Check whether audio plays & flashlight screen test',
        nodeType: 'check',
        safeActionStep: 'Listen for sound and shine a flashlight close to screen for faint menus.',
      },
      tv_goal_tech: {
        id: 'tv_goal_tech',
        label: 'Goal: Book TV technician (never open rear casing)',
        nodeType: 'goal_escalate',
        linkedCauseId: 'cause_tv_no_power',
        safeActionStep: 'High-voltage capacitors inside TVs require a qualified technician.',
      },
    },
    edges: [
      { from: 'tv_start', to: 'tv_chk_outlet', reason: 'Confirm wall power and standby LED state first', preferredFacts: ['no_power', 'tv_standby_blinking'] },
      { from: 'tv_start', to: 'tv_chk_audio', reason: 'Distinguish complete power loss from backlight failure', preferredFacts: ['tv_no_picture_with_sound'] },
      { from: 'tv_chk_outlet', to: 'tv_goal_tech', reason: 'Persistent power failure requires technician board check' },
      { from: 'tv_chk_audio', to: 'tv_goal_tech', reason: 'Backlight/driver repair requires professional panel disassembly' },
    ],
  },
  microwave: {
    applianceCategory: 'microwave',
    startNodeId: 'mw_start',
    nodes: {
      mw_start: { id: 'mw_start', label: 'Start: Microwave Heating / Safety Check', nodeType: 'start' },
      mw_chk_settings: {
        id: 'mw_chk_settings',
        label: 'Level 1: Verify Cook mode, 100% power & door latch flush',
        nodeType: 'check',
        safeActionStep: 'Ensure oven is not in Timer/Demo mode and door latches cleanly.',
      },
      mw_goal_escalate: {
        id: 'mw_goal_escalate',
        label: 'Goal: Stop & book certified technician (high-voltage safety)',
        nodeType: 'goal_escalate',
        linkedCauseId: 'cause_microwave_no_heat',
        safeActionStep: 'Do NOT open microwave cabinet due to lethal high-voltage capacitor hazard.',
      },
    },
    edges: [
      { from: 'mw_start', to: 'mw_chk_settings', reason: 'Rule out non-invasive user mode or door latch issues first' },
      { from: 'mw_chk_settings', to: 'mw_goal_escalate', reason: 'High-voltage microwave components require certified repair' },
    ],
  },
  other: {
    applianceCategory: 'other',
    startNodeId: 'other_start',
    nodes: {
      other_start: { id: 'other_start', label: 'Start: General Appliance Troubleshooting', nodeType: 'start' },
      other_chk_power: {
        id: 'other_chk_power',
        label: 'Level 1: Inspect external cord, outlet & breaker state',
        nodeType: 'check',
        safeActionStep: 'Verify wall socket and visually check cord without touching damaged areas.',
      },
      other_goal_safe: {
        id: 'other_goal_safe',
        label: 'Goal: Safe external filter/outlet check',
        nodeType: 'goal_safe',
        safeActionStep: 'Complete safe external reset or user-serviceable filter check.',
      },
      other_goal_escalate: {
        id: 'other_goal_escalate',
        label: 'Goal: Disconnect and contact certified technician',
        nodeType: 'goal_escalate',
        linkedCauseId: 'cause_general_electrical_trip',
        safeActionStep: 'Unplug appliance and request certified technician evaluation.',
      },
    },
    edges: [
      { from: 'other_start', to: 'other_chk_power', reason: 'Always verify safe power and external cord integrity first' },
      { from: 'other_chk_power', to: 'other_goal_escalate', reason: 'Breaker trips or hazard signs require immediate professional escalation', preferredFacts: ['trips_breaker'] },
      { from: 'other_chk_power', to: 'other_goal_safe', reason: 'No hazard detected; proceed with safe external checks' },
    ],
  },
};
