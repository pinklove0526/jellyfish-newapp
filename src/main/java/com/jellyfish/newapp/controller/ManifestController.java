package com.jellyfish.newapp.controller;

import java.util.List;

import com.jellyfish.newapp.config.MfeProperties;
import com.jellyfish.newapp.config.MfeProperties.Tile;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ManifestController {

    private static final String UNKNOWN = "unknown";

    private final MfeProperties properties;
    private final ObjectProvider<BuildProperties> buildProperties;

    public ManifestController(MfeProperties properties, ObjectProvider<BuildProperties> buildProperties) {
        this.properties = properties;
        this.buildProperties = buildProperties;
    }

    /** Which tiles exist, where their modules live and whether they are enabled, plus what is deployed. */
    @GetMapping("/api/manifest")
    public ResponseEntity<Manifest> manifest() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .body(new Manifest(build(), properties.tiles()));
    }

    private Build build() {
        BuildProperties info = buildProperties.getIfAvailable();
        if (info == null) {
            return new Build(UNKNOWN, UNKNOWN, UNKNOWN, null);
        }
        return new Build(
                orUnknown(info.getName()),
                orUnknown(info.getVersion()),
                orUnknown(info.get("gitSha")),
                info.getTime() == null ? null : info.getTime().toString());
    }

    private static String orUnknown(String value) {
        return StringUtils.hasText(value) ? value : UNKNOWN;
    }

    /** What is deployed: the Maven artifact, the commit it was built from and when. */
    public record Build(String app, String version, String gitSha, String builtAt) {
    }

    public record Manifest(Build build, List<Tile> tiles) {
    }
}
