// content/campaign.js — THE QUIET LEDGER, a three-mission arc.
'use strict';

var CAMPAIGN = {
  title: 'THE QUIET LEDGER',
  story: [
    'The Quiet Ledger was never a bank. It was a private intelligence brokerage that sold protection to the highest bidder, and for eleven years its officers moved dossiers, bought silence, and buried a single manifest: a ledger of every bribe, every black operation, every name that had been paid to look away. That manifest surfaced at Meridian Transit Hub in the hands of a courier with a one-way ticket out of the city. You were hired to lift it before it left the platform.',
    'Then the Ledger\'s auditor, Mara Vance, began reconciling the books at Halcyon Archive. She found the name of the man who had hired you at the top of the payor list. The contract changed overnight: silence the auditor before she could copy the backup. You took the job. But inside the vault you read her notes and learned the truth — she was not embezzling. She was building a case against the entire network, and Director Halden, your own handler, was its architect. You lowered the blade. You staged her death, and the Ledger believed her dead.',
    'Now Halden knows a witness still breathes. Mara — the "asset" — is hidden in a coastal glasshouse while a cleanup team closes the net. Your new contract is to extract her before they do. The twist is that the asset is the woman you were paid to kill, and the manifest\'s true author is the handler who hired you. Deliver her to Halden and the Ledger survives; deliver her anywhere else and it burns. This time the destination is yours to choose.'
  ].join('\n\n'),
  missions: [
    {
      id: 'm1_manifest',
      name: 'THE MANIFEST',
      brief: 'A courier is carrying the Quiet Ledger manifest through Meridian Transit Hub in a sealed data case. Lift a copy in the Parcel Office and leave the way you came. The courier is not the target — the case is.',
      mapId: 'transit',
      insert: { cell: 'A1', facing: 'N', posture: 'crouch' },
      enemies: [
        { id:'T-01', name:'Concourse Guard', role:'guard', cell:'D2', facing:'E', range:7, weapon:'pistol', patrol:['D2','E2','D2','C2'] },
        { id:'T-02', name:'Platform Guard', role:'guard', cell:'F2', facing:'N', range:7, weapon:'pistol', patrol:['F2','F3','F4','F3'] },
        { id:'T-03', name:'Courier Dell', role:'courier', cell:'D3', facing:'S', range:0, weapon:'none', traits:{ alertness:45, curiosity:20, nerve:40, discipline:40 } },
        { id:'T-04', name:'Bodyguard Rusk', role:'bodyguard', cell:'E3', facing:'W', range:8, weapon:'smg' },
        { id:'T-05', name:'Ticket Clerk', role:'technician', cell:'C2', facing:'S', range:0, weapon:'none' },
        { id:'T-06', name:'Transit Officer', role:'guard', cell:'E4', facing:'N', range:7, weapon:'pistol' }
      ],
      cameras: [
        { id:'T-CAM-1', name:'Concourse Cam', cell:'D1', facing:'S', fov:90, range:8, ir:false, monitor:'Security Desk', monitorPost:'E4', attention:55 },
        { id:'T-CAM-2', name:'Parcel Cam', cell:'D3', facing:'W', fov:75, range:6, ir:true, monitor:'Security Desk', monitorPost:'E4', attention:65 },
        { id:'T-CAM-3', name:'Platform Cam', cell:'F3', facing:'S', fov:100, range:9, ir:false, monitor:'Platform Booth', monitorPost:'F4', attention:45, pan:true }
      ],
      intel: {
        summary: 'Courier Dell carries the manifest in a sealed case inside the Parcel Office at D3.',
        patrolWindow: 'The platform guard loops F2-F4 roughly every 40 seconds.',
        cameraBlind: 'The glass partition at B3 is unwatched; the parcel cam covers only D3.',
        hazard: 'The parcel office door C3-D3 is locked; the main archway C1-D1 stands open.',
        hint: 'Copy the case at D3. Killing the courier is unnecessary and burns the contract.'
      },
      objectives: [
        { id:'obj_copy', type:'copy', target:'D3', desc:'Copy the manifest from the courier\'s sealed case in the Parcel Office.' },
        { id:'obj_extract', type:'extract', target:'A1', desc:'Leave the hub through the service tunnel.' }
      ],
      deadline: 240,
      exit: { cell: 'A1' },
      rewards: { credits: 4500, reputation: 8 }
    },
    {
      id: 'm2_auditor',
      name: 'THE AUDITOR',
      brief: 'Auditor Mara Vance is working late in the Records Vault, reconciling the Ledger\'s books. The contract says silence her before she copies the backup. Get into the vault, kill the alarm, and take her case file.',
      mapId: 'archive',
      insert: { cell: 'A1', facing: 'N', posture: 'crouch' },
      enemies: [
        { id:'A-01', name:'Lobby Guard', role:'guard', cell:'C1', facing:'E', range:7, weapon:'pistol', patrol:['C1','D1','C1','B1'] },
        { id:'A-02', name:'Stacks Guard', role:'guard', cell:'F3', facing:'S', range:7, weapon:'pistol', patrol:['F3','F4','F3','E3'] },
        { id:'A-03', name:'Vault Technician', role:'technician', cell:'D4', facing:'N', range:0, weapon:'none' },
        { id:'A-04', name:'Mara Vance', role:'target', cell:'D3', facing:'W', range:0, weapon:'none', traits:{ alertness:35, curiosity:10, nerve:30, discipline:30 } },
        { id:'A-05', name:'Bodyguard Kessler', role:'bodyguard', cell:'C3', facing:'E', range:8, weapon:'smg' },
        { id:'A-06', name:'Bodyguard Rahn', role:'bodyguard', cell:'E3', facing:'W', range:8, weapon:'smg' },
        { id:'A-07', name:'Night Watch', role:'guard', cell:'B2', facing:'N', range:7, weapon:'pistol', patrol:['B2','C2','D2','C2'] }
      ],
      cameras: [
        { id:'AR-CAM-1', name:'Lobby Cam', cell:'D1', facing:'S', fov:90, range:8, ir:false, monitor:'Security Desk', monitorPost:'F3', attention:60 },
        { id:'AR-CAM-2', name:'Vault Cam', cell:'D3', facing:'S', fov:70, range:5, ir:true, monitor:'Vault Control', monitorPost:'D4', attention:75 },
        { id:'AR-CAM-3', name:'Stacks Cam', cell:'C3', facing:'E', fov:80, range:7, ir:false, monitor:'Security Desk', monitorPost:'F3', attention:50, pan:true }
      ],
      intel: {
        summary: 'Mara Vance works alone in the Records Vault at D3, guarded at close range.',
        twistHint: 'Her case file shows she is building a prosecution against the network — Halden is named as the architect.',
        patrolWindow: 'The night watch loops B2-D2 about every 60 seconds.',
        hazard: 'Vault doors C3-D3 and D3-D4 are locked; the vault camera has infrared.',
        hint: 'Disable Vault Control at D4 first, then take the file. Consider what the contract is really buying.'
      },
      objectives: [
        { id:'obj_deactivate', type:'deactivate', target:'D4', desc:'Disable the vault alarm at Vault Control.' },
        { id:'obj_eliminate', type:'eliminate', target:'A-04', desc:'Silence the auditor before she copies the backup.' },
        { id:'obj_copy', type:'copy', target:'D3', desc:'Copy her case file from the Records Vault.' },
        { id:'obj_extract', type:'extract', target:'A1', desc:'Exit through the loading dock.' }
      ],
      deadline: 300,
      exit: { cell: 'A1' },
      rewards: { credits: 6500, reputation: 12 }
    },
    {
      id: 'm3_glasshouse',
      name: 'THE GLASSHOUSE',
      brief: 'The asset is held at a coastal safehouse called the Glasshouse, and a cleanup team is coming. Cut the comms relay, take the courier\'s duplicate manifest, and get the asset out through the cliff extraction point before the sweep arrives.',
      mapId: 'safehouse',
      insert: { cell: 'A1', facing: 'N', posture: 'prone' },
      enemies: [
        { id:'S-01', name:'Perimeter Guard', role:'guard', cell:'B2', facing:'N', range:7, weapon:'pistol', patrol:['B2','B3','B2','C2'] },
        { id:'S-02', name:'Perimeter Guard', role:'guard', cell:'C1', facing:'E', range:7, weapon:'pistol', patrol:['C1','D1','C1','B1'] },
        { id:'S-03', name:'Rooftop Spotter', role:'guard', cell:'D5', facing:'S', range:9, weapon:'rifle' },
        { id:'S-04', name:'Director Halden', role:'target', cell:'D3', facing:'N', range:0, weapon:'none', traits:{ alertness:40, curiosity:10, nerve:35, discipline:50 } },
        { id:'S-05', name:'Cleaner Voss', role:'bodyguard', cell:'D4', facing:'N', range:8, weapon:'smg' },
        { id:'S-06', name:'Cleaner Ilya', role:'bodyguard', cell:'E3', facing:'W', range:8, weapon:'smg' },
        { id:'S-07', name:'Comms Technician', role:'technician', cell:'E5', facing:'W', range:0, weapon:'none' },
        { id:'S-08', name:'Courier Renn', role:'courier', cell:'F4', facing:'N', range:0, weapon:'none', traits:{ alertness:45, curiosity:20, nerve:40, discipline:40 } }
      ],
      cameras: [
        { id:'SH-CAM-1', name:'Gate Cam', cell:'C2', facing:'W', fov:90, range:8, ir:false, monitor:'Comms Room', monitorPost:'E3', attention:60 },
        { id:'SH-CAM-2', name:'Study Cam', cell:'D3', facing:'S', fov:75, range:6, ir:true, monitor:'Comms Room', monitorPost:'E3', attention:70 },
        { id:'SH-CAM-3', name:'Cliff Cam', cell:'F3', facing:'W', fov:100, range:9, ir:false, monitor:'Observation Deck', monitorPost:'E5', attention:55, pan:true },
        { id:'SH-CAM-4', name:'Safe Room Cam', cell:'E4', facing:'N', fov:70, range:5, ir:true, monitor:'Comms Room', monitorPost:'E3', attention:80 }
      ],
      intel: {
        summary: 'The asset — Mara Vance, alive — is held in the Safe Room at E4 while the cleanup team sweeps the Glasshouse.',
        twist: 'Director Halden, your former handler, has come in person to close the Ledger. The asset is the woman you were paid to kill.',
        patrolWindow: 'Perimeter guards loop the garden about every 45 seconds.',
        hazard: 'The cliff extraction at F5 is exposed; the cliff camera pans and the safe room camera has infrared.',
        hint: 'Kill the relay at E5 before the sweep can call reinforcements. Choose where the asset goes.'
      },
      objectives: [
        { id:'obj_deactivate', type:'deactivate', target:'E5', desc:'Kill the comms relay so the sweep cannot call reinforcements.' },
        { id:'obj_copy', type:'copy', target:'F4', desc:'Take the duplicate manifest from the fleeing courier.' },
        { id:'obj_extract', type:'extract', target:'E4', desc:'Get the asset out of the Safe Room.' }
      ],
      deadline: 360,
      exit: { cell: 'F5' },
      rewards: { credits: 9000, reputation: 20 }
    }
  ]
};

module.exports = { CAMPAIGN: CAMPAIGN };
