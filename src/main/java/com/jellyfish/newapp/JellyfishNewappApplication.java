package com.jellyfish.newapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class JellyfishNewappApplication {

    public static void main(String[] args) {
        SpringApplication.run(JellyfishNewappApplication.class, args);
    }
}
