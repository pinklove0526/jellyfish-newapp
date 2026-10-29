package com.jellyfish.newapp.controller;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ManifestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void servesTheConfiguredManifestAsUncachedJson() throws Exception {
        mockMvc.perform(get("/api/manifest").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-cache")))
                .andExpect(jsonPath("$.tiles", hasSize(13)))
                .andExpect(jsonPath("$.tiles[0].id", is("clock")))
                .andExpect(jsonPath("$.tiles[0].title", is("Clock")))
                .andExpect(jsonPath("$.tiles[0].version", is("1.0.0")))
                .andExpect(jsonPath("$.tiles[0].moduleUrl", is("/tiles/clock/v1/index.js")))
                .andExpect(jsonPath("$.tiles[0].enabled", is(true)));
    }

    @Test
    void everyTileHasAVersionedModuleUrlMatchingItsId() throws Exception {
        JsonNode tiles = manifest().get("tiles");
        assertThat(tiles).isNotEmpty();
        for (JsonNode tile : tiles) {
            assertThat(tile.get("moduleUrl").asText())
                    .matches("/tiles/" + tile.get("id").asText() + "/v\\d+/index\\.js");
        }
    }

    @Test
    void tileIdsAreUnique() throws Exception {
        JsonNode tiles = manifest().get("tiles");
        long distinct = java.util.stream.StreamSupport.stream(tiles.spliterator(), false)
                .map(tile -> tile.get("id").asText())
                .distinct()
                .count();
        assertThat(distinct).isEqualTo(tiles.size());
    }

    @Test
    void everyModuleUrlInTheManifestIsActuallyServed() throws Exception {
        for (JsonNode tile : manifest().get("tiles")) {
            mockMvc.perform(get(tile.get("moduleUrl").asText()))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void reportsBuildInfo() throws Exception {
        mockMvc.perform(get("/api/manifest"))
                .andExpect(jsonPath("$.build.app", is("jellyfish-newapp")))
                .andExpect(jsonPath("$.build.version", matchesPattern("\\S+")))
                .andExpect(jsonPath("$.build.gitSha", matchesPattern("\\S+")))
                .andExpect(jsonPath("$.build.builtAt", matchesPattern("\\d{4}-\\d{2}-\\d{2}T.*Z")));
    }

    private JsonNode manifest() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/manifest")).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    @Nested
    @SpringBootTest(properties = {
            "mfe.tiles[0].id=solo",
            "mfe.tiles[0].title=Solo",
            "mfe.tiles[0].version=2.1.0",
            "mfe.tiles[0].module-url=/tiles/solo/v2/index.js",
            "mfe.tiles[0].enabled=false",
            "mfe.tiles[0].color=teal"
    })
    @AutoConfigureMockMvc
    class WithOverriddenTiles {

        @Autowired
        private MockMvc overridden;

        @Test
        void listsDisabledTilesWithTheirFlagAndAppliesDefaults() throws Exception {
            overridden.perform(get("/api/manifest"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.tiles", hasSize(1)))
                    .andExpect(jsonPath("$.tiles[0].id", is("solo")))
                    .andExpect(jsonPath("$.tiles[0].enabled", is(false)))
                    .andExpect(jsonPath("$.tiles[0].group", is("Apps")))
                    .andExpect(jsonPath("$.tiles[0].size", is("small")));
        }
    }
}
