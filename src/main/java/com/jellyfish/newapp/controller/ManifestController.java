package com.jellyfish.newapp.controller;

import java.util.List;

import com.jellyfish.newapp.config.MfeProperties;
import com.jellyfish.newapp.config.MfeProperties.Tile;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ManifestController {

    private final MfeProperties properties;

    public ManifestController(MfeProperties properties) {
        this.properties = properties;
    }

    /** Which tiles exist, where their modules live, and whether they are enabled. */
    @GetMapping("/api/manifest")
    public ResponseEntity<Manifest> manifest() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .body(new Manifest(properties.tiles()));
    }

    public record Manifest(List<Tile> tiles) {
    }
}
