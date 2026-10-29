package com.jellyfish.newapp.controller;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

@WebMvcTest(HomeController.class)
class HomeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void rendersTheStartPage() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(view().name("index"))
                .andExpect(model().attribute("appName", "Jellyfish"))
                .andExpect(content().string(containsString("<h1>Start</h1>")));
    }

    @Test
    void pointsTheShellAtTheManifestAndLoadsItAsAModule() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(content().string(containsString("data-manifest-url=\"/api/manifest\"")))
                .andExpect(content().string(containsString("<script type=\"module\" src=\"/js/main.js\"")));
    }

    @Test
    void doesNotHardCodeAnyTile() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(content().string(containsString("id=\"groups\"")))
                .andExpect(content().string(org.hamcrest.Matchers.not(containsString("data-tile="))));
    }
}
