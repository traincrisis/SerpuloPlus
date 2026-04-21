const JFrame = Packages.javax.swing.JFrame;
const JLabel = Packages.javax.swing.JLabel;
const ImageIcon = Packages.javax.swing.ImageIcon;
const Image = Packages.java.awt.Image;

let jumpscareTriggered = false;
let soundIds = [-1, -1, -1, -1]; // [Malign, Differential, ElectricHum, Bio]

// --- FORSAKEN SPIRIT LOGIC ---
Events.run(Trigger.draw, () => {
    if (Vars.headless || !Vars.ui || !Vars.ui.hudfrag.shown || Vars.state.isPaused()) return;
    
    let player = Vars.player.unit();
    let maxIntensity = 0;
    
    if (player != null) {
        Groups.unit.each(u => {
            if (u.team != player.team && u.type.name.includes("forsaken-spirit")) {
                let dst = u.dst(player);
                if (dst < 500) {
                    let intensity = 1 - (dst / 500);
                    if (intensity > maxIntensity) maxIntensity = intensity;
                }
            }
        });
    }
    
    if (maxIntensity > 0) {
        Draw.draw(Layer.max, () => {
            Draw.color(Color.red);
            Draw.alpha(maxIntensity * 0.7);
            // Red overlay box
            Fill.crect(Core.camera.position.x - (Core.camera.width * 0.7), Core.camera.position.y - (Core.camera.height * 0.7), Core.camera.width * 1.4, Core.camera.height * 1.4);
        });
        Draw.reset();
        if(Vars.renderer != null) Vars.renderer.shake(maxIntensity * 12, maxIntensity * 12);
    }
});

Events.run(Trigger.update, () => {
    if (Vars.headless || !Vars.player || Vars.state.isPaused() || jumpscareTriggered) {
        soundIds.forEach((id, i) => { if(id != -1) { Core.audio.stop(id); soundIds[i] = -1; } });
        return;
    }

    let player = Vars.player.unit();
    if (player == null) return;

    let foundSpirit = false;
    Groups.unit.each(u => {
        if (u.team != player.team && u.type.name.includes("forsaken-spirit")) {
            foundSpirit = true;
            let dst = u.dst(player);
            
            // Audio Feedback: 4-Layer Drone
            if (dst < 600) {
                let vol = 1 - (dst / 600);
                let sounds = [Sounds.loopMalign, Sounds.loopDifferential, Sounds.loopElectricHum, Sounds.loopBio];
                
                sounds.forEach((snd, i) => {
                    if (snd && soundIds[i] == -1) {
                        soundIds[i] = snd.play(0, 1, 0);
                        if(soundIds[i] != -1) Core.audio.setLooping(soundIds[i], true);
                    }
                    if (soundIds[i] != -1) {
                        Core.audio.setVolume(soundIds[i], vol * 1.5);
                        Core.audio.setPitch(soundIds[i], 1.0 - (vol * 0.2) + (i * 0.1));
                    }
                });
            }
            
            // Trigger Jumpscare
            if (dst < 85) {
                jumpscareTriggered = true;
                soundIds.forEach(id => { if(id != -1) Core.audio.stop(id); });
                
                if (Sounds.explosionReactor) Sounds.explosionReactor.play();
                
                try {
                    let frame = new JFrame("ROUTER_CATASTROPHE");
                    frame.setUndecorated(true);
                    frame.setAlwaysOnTop(true);
                    let imgPath = Vars.mods.getMod("serpuloplus").file.child("sprites/extras/forbidden-eye.png").path();
                    let icon = new ImageIcon(imgPath);
                    let scaledImage = icon.getImage().getScaledInstance(1000, 1000, Image.SCALE_SMOOTH);
                    frame.add(new JLabel(new ImageIcon(scaledImage)));
                    frame.pack();
                    frame.setLocationRelativeTo(null); 
                    frame.setVisible(true);
                } catch(e) {
                    Log.err("Failed to open JFrame jumpscare: " + e);
                }
                
                Timer.schedule(() => { Core.app.exit(); }, 1.5);
            }
        }
    });
    
    if(!foundSpirit) {
        soundIds.forEach((id, i) => { if(id != -1) { Core.audio.stop(id); soundIds[i] = -1; } });
    }
});

// --- SPORE SYSTEM ---
Events.on(ContentInitEvent, () => {
    const inv = Vars.content.block("serpuloplus-spore-invader");
    const col = Vars.content.block("serpuloplus-spore-collector");

    const dSand = Vars.content.block("darksand");
    const dSandTainted = Vars.content.block("darksand-tainted-water");
    const tWater = Vars.content.block("tainted-water");
    const dTWater = Vars.content.block("deep-tainted-water");
    const moss = Vars.content.block("moss");
    const sMoss = Vars.content.block("spore-moss");
    const shale = Vars.content.block("shale");
    const sand = Vars.content.block("sand-floor");
    const sWater = Vars.content.block("sand-water");
    const water = Vars.content.block("shallow-water");
    const dWater = Vars.content.block("deep-water");

    if(inv != null){
        inv.buildType = () => extend(GenericCrafter.GenericCrafterBuild, inv, {
            updateTile(){
                this.super$updateTile();
                this.progress = 0; 
                if(this.efficiency > 0 && this.items.has(Items.sporePod) && this.timer.get(0, 30)){
                    let range = 10, found = false;
                    for(let x = -range; x <= range && !found; x++){
                        for(let y = -range; y <= range && !found; y++){
                            let targetTile = Vars.world.tile(this.tileX() + x, this.tileY() + y);
                            if(!targetTile) continue;
                            let fId = targetTile.floor().name;
                            let bId = targetTile.block().name;
                            let changed = false;

                            if(fId === "sand-floor") { targetTile.setFloor(dSand); changed = true; }
                            else if(fId === "sand-water" || fId === "darksand-water") { targetTile.setFloor(dSandTainted); changed = true; }
                            else if(fId === "shallow-water") { targetTile.setFloor(tWater); changed = true; }
                            else if(fId === "deep-water") { targetTile.setFloor(dTWater); changed = true; }
                            else if(fId === "shale") { targetTile.setFloor(Math.random() < 0.01 ? sMoss : moss); changed = true; }

                            if(bId === "shale-wall") { targetTile.setNet(Blocks.sporeWall); changed = true; }
                            else if(bId === "sand-wall") { targetTile.setNet(Blocks.duneWall); changed = true; }
                            else if(bId === "sand-boulder") { targetTile.setNet(Blocks.basaltBoulder); changed = true; }
                            else if(bId === "shale-boulder") { targetTile.setNet(Blocks.sporeCluster); changed = true; }

                            if(changed){ found = true; Fx.pulverizeSmall.at(targetTile.worldx(), targetTile.worldy()); }
                        }
                    }
                    if(found) { this.items.remove(Items.sporePod, 1); Fx.smeltsmoke.at(this.x, this.y); }
                }
            }
        });
    }

    if(col != null){
        col.buildType = () => {
            let tickCount = 0;
            return extend(GenericCrafter.GenericCrafterBuild, col, {
                updateTile(){
                    this.super$updateTile();
                    this.progress = 0;
                    if(this.efficiency > 0) tickCount++;
                    if(tickCount >= 30){
                        tickCount = 0;
                        let range = 10, count = 0;
                        for(let x = -range; x <= range; x++){
                            for(let y = -range; y <= range; y++){
                                let targetTile = Vars.world.tile(this.tileX() + x, this.tileY() + y);
                                if(!targetTile) continue;
                                if(targetTile.floor().name === "darksand"){ 
                                    targetTile.setFloor(sand); 
                                    count++; 
                                    break; 
                                }
                            }
                            if(count > 0) break;
                        }
                        if(count > 0) { this.items.add(Items.sporePod, count); Fx.heal.at(this.x, this.y); }
                    }
                }
            });
        };
    }
});
