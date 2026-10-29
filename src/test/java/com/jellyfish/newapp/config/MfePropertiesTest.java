package com.jellyfish.newapp.config;

import java.util.Arrays;
import java.util.List;

import com.jellyfish.newapp.config.MfeProperties.Tile;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

class MfePropertiesTest {

    private static Tile tile(String id) {
        return new Tile(id, "Title", "1.0.0", "/tiles/" + id + "/v1/index.js", true, "Apps", "small", "cyan");
    }

    @Test
    void nullOrEmptyTilesBecomeAnEmptyManifest() {
        assertThat(new MfeProperties(null).tiles()).isEmpty();
        assertThat(new MfeProperties(List.of()).tiles()).isEmpty();
    }

    @Test
    void keepsTilesInConfiguredOrder() {
        assertThat(new MfeProperties(List.of(tile("b"), tile("a"))).tiles())
                .extracting(Tile::id).containsExactly("b", "a");
    }

    @Test
    void rejectsDuplicateIds() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new MfeProperties(List.of(tile("clock"), tile("clock"))))
                .withMessageContaining("Duplicate tile id: clock");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "Clock", "1clock", "my_tile", "a b"})
    void rejectsBadIds(String id) {
        assertThatIllegalArgumentException().isThrownBy(() -> tile(id));
    }

    @Test
    void rejectsNullIds() {
        assertThatIllegalArgumentException().isThrownBy(() -> tile(null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "  ", "tiles/a.js", "//evil.example/a.js", "https://evil.example/a.js", "javascript:alert(1)"})
    void rejectsModuleUrlsThatAreNotSameOriginPaths(String url) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new Tile("a", "A", "1.0.0", url, true, "Apps", "small", "cyan"))
                .withMessageContaining("module-url");
    }

    @Test
    void rejectsMissingTitleVersionGroupOrColour() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new Tile("a", " ", "1.0.0", "/a.js", true, "Apps", "small", "cyan"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new Tile("a", "A", null, "/a.js", true, "Apps", "small", "cyan"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new Tile("a", "A", "1.0.0", "/a.js", true, "", "small", "cyan"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new Tile("a", "A", "1.0.0", "/a.js", true, "Apps", "small", null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "huge", "Small"})
    void rejectsUnknownSizes(String size) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new Tile("a", "A", "1.0.0", "/a.js", true, "Apps", size, "cyan"))
                .withMessageContaining("size");
    }

    @ParameterizedTest
    @ValueSource(strings = {"Cyan", "w3-win8-cyan", "cy an", "\"><x"})
    void rejectsColourNamesThatCouldInjectClassesOrMarkup(String colour) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new Tile("a", "A", "1.0.0", "/a.js", true, "Apps", "small", colour));
    }

    @Test
    void tilesListIsDefensivelyCopied() {
        Tile[] source = {tile("a")};
        List<Tile> input = new java.util.ArrayList<>(Arrays.asList(source));
        MfeProperties properties = new MfeProperties(input);
        input.add(tile("b"));
        assertThat(properties.tiles()).hasSize(1);
    }
}
