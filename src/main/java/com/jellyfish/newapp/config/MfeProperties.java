package com.jellyfish.newapp.config;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.Assert;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

/**
 * The tiles the shell may load, bound from {@code mfe.tiles} in application.yml.
 * Validation runs at startup, so a bad manifest stops the app instead of
 * reaching the browser.
 */
@ConfigurationProperties(prefix = "mfe")
public record MfeProperties(List<Tile> tiles) {

    public MfeProperties {
        tiles = CollectionUtils.isEmpty(tiles) ? List.of() : List.copyOf(tiles);
        Set<String> seen = new HashSet<>();
        for (Tile tile : tiles) {
            Assert.isTrue(seen.add(tile.id()), () -> "Duplicate tile id: " + tile.id());
        }
    }

    /**
     * One manifest entry.
     *
     * @param id        stable identifier, also used as the tile's DOM key
     * @param title     human-readable name
     * @param version   version of the tile module
     * @param moduleUrl same-origin path of the ES module the shell imports
     * @param enabled   whether the shell should load the tile
     * @param group     heading the tile is listed under
     * @param size      small, wide or large
     * @param color     w3-colors-win8 name, without the {@code w3-win8-} prefix
     */
    public record Tile(
            String id,
            String title,
            String version,
            String moduleUrl,
            @DefaultValue("true") boolean enabled,
            @DefaultValue("Apps") String group,
            @DefaultValue("small") String size,
            String color) {

        private static final Set<String> SIZES = Set.of("small", "wide", "large");

        public Tile {
            Assert.isTrue(StringUtils.hasText(id) && id.matches("[a-z][a-z0-9-]*"),
                    () -> "Tile id must be lower-case letters, digits and dashes: '" + id + "'");
            Assert.hasText(title, () -> "Tile '" + id + "' needs a title");
            Assert.hasText(version, () -> "Tile '" + id + "' needs a version");
            Assert.isTrue(StringUtils.hasText(moduleUrl) && moduleUrl.startsWith("/") && !moduleUrl.startsWith("//"),
                    () -> "Tile '" + id + "' module-url must be a same-origin path starting with a single '/'");
            Assert.hasText(group, () -> "Tile '" + id + "' needs a group");
            Assert.isTrue(SIZES.contains(size), () -> "Tile '" + id + "' size must be one of " + SIZES);
            Assert.isTrue(StringUtils.hasText(color) && color.matches("[a-z0-9]+"),
                    () -> "Tile '" + id + "' needs a colour name such as 'cyan'");
        }
    }
}
