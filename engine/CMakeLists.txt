cmake_minimum_required(VERSION 3.16)

project(trading_engine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(trading_engine
    src/main.cpp
    src/Strategy.cpp
    src/CandleFeed.cpp
    src/Indicators.cpp
    src/MarketStructure.cpp
    src/Analysis.cpp
)

target_include_directories(trading_engine PRIVATE include)

# Optional: build tests if the tests/ directory has sources (Phase 4 adds
# a first smoke test for CandleFeed; Phase 5 adds indicator/structure
# tests). Building tests never blocks the main engine target.
file(GLOB TEST_SOURCES tests/*.cpp)
if(TEST_SOURCES)
    add_executable(engine_tests
        ${TEST_SOURCES}
        src/Strategy.cpp
        src/CandleFeed.cpp
        src/Indicators.cpp
        src/MarketStructure.cpp
        src/Analysis.cpp
    )
    target_include_directories(engine_tests PRIVATE include)
endif()
