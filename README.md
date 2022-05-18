# FlexType VS Code Extension

<!-- to do: add shield + marketplace link -->

FlexType provides static and machine-learning based type inference, as well as automatic type annotation for developers to use with TypeScript codebases.

## Features

* Both static and machine-learning based type inference *(powered by the TypeScript compiler's type checker and [ManyTypes4TypeScript](https://huggingface.co/kevinjesse/codebert-MT4TS>))*
* Type recommendations and automatic embedding of formal type annotations for type permissive locations *(i.e. variables, parameters, functions, methods)*
* Support for both TypeScript and JavaScript:
    * Type recommendations available for both TypeScript (.ts) and JavaScript (.js) files
    * Automatic type annotation available for TypeScript files
* Easy-to-use extension interface  

## Requirements

Use the following command to install required Python libraries for this extension:

`python -m pip install -r requirements.txt`

## Installation

The extension can be installed from the Visual Studio Marketplace.
<!-- to do: add marketplace link -->

## Usage
Once the FlexType extension and required dependencies are installed, follow the instructions below to start using the extension.

1. In the VS Code editor, open a TypeScript or JavaScript project and select a specific source file of choice (.ts or .js)
2. Open the Command Palette (using `View > Command Palette` or the appropriate keyboard shortcut)
3. Select the command `FlexType: Suggest Types` to activate the extension
4. Hover over a type permissive location in the source code to see a dialog with recommended types
    > Hover Dialog Anatomy: ![](images/FlexTypeHoverAnatomy.png)


5. Use the corresponding keystrokes from the hover dialog to accept a type suggestion and prompt automatic annotation *(for Typescript files (.ts) only)*

<!-- ## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension. -->

## Release Notes

### 1.0.0

Initial release of FlexType.